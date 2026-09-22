import express from "express";
import { validatePilotReview } from "../../shared/pilotReview.js";
import { normalizeReportingPeriod } from "../../shared/reportingPeriod.js";
import { generatePilotReview } from "../pilot/generatePilotReview.js";

const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const errors = {
  PILOT_REQUEST_CONFLICT: [409, "That submission already used different data. Start a new review."],
  PILOT_ACCOUNT_LIMIT: [429, "You have used the six reviews available in this pilot. Your saved reviews remain available."],
  PILOT_BUDGET_LIMIT: [429, "The pilot review allowance has been used. Your saved reviews remain available."],
  PILOT_REVIEW_NOT_FOUND: [404, "The completed review could not be found for your account."],
};
function fail(error, res) {
  const [status, message] = errors[error.message] || [503, "The review service is temporarily unavailable. Check saved reviews before submitting again."];
  return res.status(status).json({ error: errors[error.message] ? error.message : "PILOT_REVIEW_UNAVAILABLE", message });
}

export function createPilotRouter({ store, access, generate = generatePilotReview } = {}) {
  const router = express.Router();
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use(access.requireAccess);
  router.use((req, res, next) => {
    // Disabled pilot must never fall through to an unguarded paid call.
    if (!req.pilotIdentity || !store) return res.status(503).json({ error: "PILOT_NOT_READY", message: "The private review pilot is not available yet." });
    return next();
  });
  router.get("/reviews", async (req, res) => {
    try { return res.json({ reviews: await store.list(req.pilotIdentity.etsyUserId) }); }
    catch (error) { return fail(error, res); }
  });
  router.post("/reviews", async (req, res) => {
    const { errors: validationErrors, value: input } = validatePilotReview(req.body?.input);
    if (!uuid(req.body?.requestKey)) validationErrors.push("A valid submission ID is required. Reload the planner.");
    if (validationErrors.length) return res.status(400).json({ error: "PILOT_INPUT_INVALID", message: validationErrors.join(" "), errors: validationErrors });
    let reservation;
    const user = req.pilotIdentity.etsyUserId;
    try {
      reservation = await store.reserve(user, req.body.requestKey, input);
      if (!reservation.fresh) return res.status(reservation.review.status === "pending" ? 202 : 200).json({ review: reservation.review });
      // Reservation commits BEFORE the network call. No automatic refund/retry:
      // a timeout or crash may still have incurred a provider charge.
      const generated = await generate(input);
      const review = await store.finish(user, reservation.review.id, { input, ...generated }, "complete");
      return res.json({ review });
    } catch (error) {
      if (reservation?.fresh) {
        await store.finish(user, reservation.review.id, { input }, "failed").catch(() => {});
      }
      return fail(error, res);
    }
  });
  router.post("/reviews/:id/outcome", async (req, res) => {
    if (!uuid(req.params.id)) return res.status(400).json({ error: "PILOT_INPUT_INVALID", message: "Choose a saved review." });
    try {
      const reviews = await store.list(req.pilotIdentity.etsyUserId);
      const review = reviews.find(item => item.id === req.params.id && item.status === "complete");
      if (!review) throw new Error("PILOT_REVIEW_NOT_FOUND");
      const { note, views, sales, reportingPeriod } = req.body || {};
      let period;
      try { period = normalizeReportingPeriod(reportingPeriod); } catch { /* Report a field-specific error below. */ }
      if (typeof note !== "string" || note.trim().length < 5 || note.length > 1000 ||
          !Number.isSafeInteger(views) || views < 0 || views > 100000000 ||
          !Number.isSafeInteger(sales) || sales < 0 || sales > 100000000 ||
          !period || period.days !== review.input.reportingPeriod.days ||
          period.timeZone !== review.input.reportingPeriod.timeZone ||
          period.startDate <= review.input.reportingPeriod.endDate) {
        return res.status(400).json({ error: "PILOT_OUTCOME_INVALID", message: "Describe the change (5–1,000 characters), enter whole non-negative views and sales, and choose a later completed period with the same length and time zone as the original." });
      }
      const saved = await store.outcome(req.pilotIdentity.etsyUserId, req.params.id, { note: note.trim(), views, sales, reportingPeriod: period });
      return res.json({ review: saved });
    } catch (error) { return fail(error, res); }
  });
  return router;
}
