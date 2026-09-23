import { createHash, randomUUID } from "node:crypto";
import { PILOT_TERMS_VERSION } from "../../shared/pilotTerms.js";

export const PILOT_BUDGET_CAD_CENTS = 3000;
export const PILOT_RESERVATION_CAD_CENTS = 100;
export const PILOT_RUNS_PER_ACCOUNT = 6;

export function createPilotReviewStore({ pool, cipher }) {
  const encode = (id, value) => cipher.encrypt({ connectionId: "pilot-review:" + id, ...value });
  const decode = row => {
    if (!row) return null;
    const { connectionId: _domain, ...value } = cipher.decrypt("pilot-review:" + row.id, row.payload);
    return { ...value, id: row.id, status: row.status, createdAt: row.created_at };
  };
  return {
    async hasConsent(etsyUserId) {
      const result = await pool.query("SELECT 1 FROM lighthouse_pilot_consents WHERE etsy_user_id = $1 AND terms_version = $2", [etsyUserId, PILOT_TERMS_VERSION]);
      return result.rows.length === 1;
    },
    async acceptTerms(etsyUserId) {
      await pool.query("INSERT INTO lighthouse_pilot_consents (etsy_user_id, terms_version) VALUES ($1,$2) ON CONFLICT DO NOTHING", [etsyUserId, PILOT_TERMS_VERSION]);
    },
    async check() {
      await pool.query("SELECT etsy_user_id, terms_version, accepted_at FROM lighthouse_pilot_consents LIMIT 0");
      await pool.query("SELECT id, reserved_cad_cents FROM lighthouse_pilot_budget WHERE id = 1").then(result => {
        if (result.rows.length !== 1) throw new Error("PILOT_BUDGET_MISSING");
      });
      await pool.query("SELECT id, etsy_user_id, request_key, input_hash, reserved_cad_cents, status, payload, created_at FROM lighthouse_pilot_reviews LIMIT 0");
    },
    async reserve(etsyUserId, requestKey, input) {
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL lock_timeout = '5s'");
        // One durable lock serializes every reservation, including across processes.
        const budget = await client.query("SELECT reserved_cad_cents FROM lighthouse_pilot_budget WHERE id = 1 FOR UPDATE");
        if (budget.rows.length !== 1) throw new Error("PILOT_BUDGET_MISSING");
        const existing = await client.query("SELECT * FROM lighthouse_pilot_reviews WHERE etsy_user_id = $1 AND request_key = $2", [etsyUserId, requestKey]);
        if (existing.rows.length) {
          if (existing.rows[0].input_hash !== hash) throw new Error("PILOT_REQUEST_CONFLICT");
          await client.query("COMMIT");
          return { fresh: false, review: decode(existing.rows[0]) };
        }
        const count = await client.query("SELECT COUNT(*)::int AS count FROM lighthouse_pilot_reviews WHERE etsy_user_id = $1", [etsyUserId]);
        if (count.rows[0].count >= PILOT_RUNS_PER_ACCOUNT) throw new Error("PILOT_ACCOUNT_LIMIT");
        if (budget.rows[0].reserved_cad_cents + PILOT_RESERVATION_CAD_CENTS > PILOT_BUDGET_CAD_CENTS) throw new Error("PILOT_BUDGET_LIMIT");
        const id = randomUUID();
        const result = await client.query(
          "INSERT INTO lighthouse_pilot_reviews (id, etsy_user_id, request_key, input_hash, reserved_cad_cents, status, payload) VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING *",
          [id, etsyUserId, requestKey, hash, PILOT_RESERVATION_CAD_CENTS, encode(id, { input })],
        );
        await client.query("UPDATE lighthouse_pilot_budget SET reserved_cad_cents = reserved_cad_cents + $1 WHERE id = 1", [PILOT_RESERVATION_CAD_CENTS]);
        await client.query("COMMIT");
        return { fresh: true, review: decode(result.rows[0]) };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally { client.release(); }
    },
    async finish(etsyUserId, id, value, status) {
      if (!["complete", "failed"].includes(status)) throw new Error("PILOT_STATUS_INVALID");
      const result = await pool.query("UPDATE lighthouse_pilot_reviews SET payload = $3, status = $4 WHERE etsy_user_id = $1 AND id = $2 AND status = 'pending' RETURNING *",
        [etsyUserId, id, encode(id, value), status]);
      if (!result.rows.length) throw new Error("PILOT_REVIEW_NOT_PENDING");
      return decode(result.rows[0]);
    },
    async list(etsyUserId) {
      const result = await pool.query("SELECT * FROM lighthouse_pilot_reviews WHERE etsy_user_id = $1 ORDER BY created_at DESC LIMIT 6", [etsyUserId]);
      return result.rows.map(decode);
    },
    async outcome(etsyUserId, id, outcome) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const found = await client.query("SELECT * FROM lighthouse_pilot_reviews WHERE etsy_user_id = $1 AND id = $2 AND status = 'complete' FOR UPDATE", [etsyUserId, id]);
        if (!found.rows.length) throw new Error("PILOT_REVIEW_NOT_FOUND");
        const review = decode(found.rows[0]);
        const result = await client.query("UPDATE lighthouse_pilot_reviews SET payload = $3 WHERE etsy_user_id = $1 AND id = $2 RETURNING *", [etsyUserId, id, encode(id, { input: review.input, result: review.result, usage: review.usage, outcome })]);
        await client.query("COMMIT");
        return decode(result.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally { client.release(); }
    },
  };
}
