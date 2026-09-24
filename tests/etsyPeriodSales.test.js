import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import getSales from "../src/integrations/etsy/getEtsyPeriodSales.js";
import { createEtsyReadRouter } from "../src/routes/etsyReadRoutes.js";
import { mergeEtsySales, clearPeriodMetrics, requestEtsySales } from "../client/src/utils/etsySales.js";
import { createPilotAccess } from "../src/pilot/pilotAccess.js";
import { PILOT_TERMS_VERSION } from "../shared/pilotTerms.js";

const period = { startDate: "2026-09-01", endDate: "2026-09-02", timeZone: "UTC" };
const stamp = day => Date.parse(day + "T00:00:00Z") / 1000;
const shop = { shop_id: 22, user_id: 11 };
const transaction = (n, listingId = 1, quantity = 1) => ({ transaction_id: n, receipt_id: n, seller_user_id: 11, listing_id: listingId, quantity });
const receipt = (n, day = "2026-09-01", changes = {}) => ({ receipt_id: n, seller_user_id: 11, receipt_type: 0,
  created_timestamp: stamp(day), status: "paid", is_paid: true, refunds: [], transactions: [transaction(n)],
  buyer_email: "private@example.test", formatted_address: "Private address", ...changes });
const read = (pages, options = {}) => getSales({ etsyUserId: "11", shopId: "22", listingIds: ["1", "2"], reportingPeriod: period,
  now: new Date("2026-09-24"), apiGet: async args => args.query ? pages(args) : shop, ...options });
const rows = () => [{ id: "1", etsyListingId: "1", views: "35", sales: "", trendPercent: "" },
  { id: "2", etsyListingId: "2", views: "", sales: "", trendPercent: "" }];

test("imports paginated paid units for exact UTC windows; no buyer data or lifetime views escape", async () => {
  const calls = [];
  const data = await read(async args => {
    calls.push(args.query);
    const records = [receipt(1, "2026-08-30", { transactions: [transaction(1, 1, 2)] }),
      receipt(2, "2026-08-31"), receipt(3, "2026-09-01", { transactions: [transaction(3, 1, 6)] }),
      receipt(4, "2026-09-02", { created_timestamp: stamp("2026-09-03") - 1, transactions: [transaction(4, 2, 4)] })];
    return { count: 4, results: records.slice(args.query.offset, args.query.offset + 2) };
  });
  assert.deepEqual(calls.map(c => c.offset), [0, 2]);
  assert.equal(calls[0].min_created, stamp("2026-08-30"));
  assert.equal(calls[0].max_created, stamp("2026-09-03") - 1);
  assert.equal(calls[0].was_paid, true); assert.equal(calls[0].was_canceled, false);
  assert.deepEqual(data.listings, [
    { id: "1", sales: 6, previousSales: 3, trendPercent: 100, needsReview: false },
    { id: "2", sales: 4, previousSales: 0, trendPercent: null, needsReview: false },
  ]);
  assert.equal(data.viewsAvailability, "UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(data), /private@|Private address|buyer|transactions/);
  const merged = mergeEtsySales(rows(), data, "22", period);
  assert.equal(merged[0].views, "35"); assert.equal(merged[0].sales, "6"); assert.equal(merged[1].trendPercent, "");
});

test("excludes unpaid, cancelled, fully refunded and Pattern orders; partial refund never becomes a guessed count", async () => {
  const results = [receipt(1, undefined, { is_paid: false }), receipt(2, undefined, { status: "canceled" }),
    receipt(3, undefined, { status: "fully refunded" }), receipt(4, undefined, { receipt_type: 1 }),
    receipt(5, undefined, { status: "partially refunded", refunds: [{}] }), receipt(6, undefined, { transactions: [transaction(6, 2, 5)] })];
  const result = await read(async () => ({ count: results.length, results }));
  assert.deepEqual(result.listings[0], { id: "1", sales: null, previousSales: null, trendPercent: null, needsReview: true });
  assert.equal(result.listings[1].sales, 5);
});

test("complete empty response produces zero sales and unavailable trend, never invented views", async () => {
  const result = await read(async () => ({ count: 0, results: [] }));
  assert.equal(result.listings[0].sales, 0); assert.equal(result.listings[0].trendPercent, null);
  assert.equal(mergeEtsySales(rows(), result, "22", period)[1].views, "");
});

for (const [label, page] of [
  ["missing page", { count: 2, results: [] }], ["duplicate receipts", { count: 2, results: [receipt(1), receipt(1)] }],
  ["too many receipts", { count: 1001, results: [] }], ["foreign seller", { count: 1, results: [receipt(1, undefined, { seller_user_id: 99 })] }],
  ["future boundary", { count: 1, results: [receipt(1, "2026-09-03")] }],
  ["missing refund evidence", { count: 1, results: [receipt(1, undefined, { refunds: undefined })] }],
  ["missing transactions", { count: 1, results: [receipt(1, undefined, { transactions: [] })] }],
  ["fractional quantity", { count: 1, results: [receipt(1, undefined, { transactions: [transaction(1, 1, 1.2)] })] }],
]) test(`fails without partial results for ${label}`, async () => {
  await assert.rejects(read(async () => page), /ETSY_SALES_/);
});

test("rejects changed pagination and provider failure after an initial page", async () => {
  await assert.rejects(read(async ({ query }) => query.offset ? { count: 3, results: [receipt(2)] }
    : { count: 2, results: [receipt(1)] }), /ETSY_SALES_CHANGED/);
  await assert.rejects(read(async ({ query }) => {
    if (query.offset) throw new Error("ETSY_RATE_LIMITED");
    return { count: 2, results: [receipt(1)] };
  }), /ETSY_RATE_LIMITED/);
  await assert.rejects(read(async () => { throw Object.assign(Error("provider secret"), { status: 403 }); }), /ETSY_SALES_PERMISSION_REQUIRED/);
});

test("rejects wrong owner, invalid dates and oversized selection before order access", async () => {
  for (const options of [
    { reportingPeriod: { ...period, startDate: "2026-02-30" } },
    { reportingPeriod: { ...period, endDate: "2026-09-24" } },
    { reportingPeriod: { ...period, timeZone: "America/Toronto" } },
    { reportingPeriod: { ...period, startDate: "2025-01-01" } },
    { listingIds: [] }, { listingIds: ["1", "1"] }, { listingIds: Array(501).fill("1") },
  ]) await assert.rejects(read(() => assert.fail("must not read orders"), options));
  await assert.rejects(read(() => assert.fail(), { apiGet: async () => ({ ...shop, user_id: 99 }) }), /ETSY_SALES_SHOP_MISMATCH/);
});

test("client rejects mismatched shop, period, missing IDs and malformed metrics; retains manual edits and invalidates old dates", async () => {
  const data = await read(async () => ({ count: 0, results: [] }));
  for (const changed of [ { ...data, shopId: "33" }, { ...data, reportingPeriod: { ...period, startDate: "2026-08-31" } },
    { ...data, listings: [data.listings[0]] }, { ...data, listings: [{ ...data.listings[0], sales: -1 }, data.listings[1]] },
    { ...data, listings: [data.listings[0], data.listings[0]] },
  ]) assert.throws(() => mergeEtsySales(rows(), changed, "22", period));
  const input = rows(); input[0].sales = "7";
  const merged = mergeEtsySales(input, data, "22", period);
  assert.equal(merged[0].sales, "7"); assert.equal(merged[0].views, "35"); assert.equal(merged[1].sales, "0");
  const cleared = clearPeriodMetrics(merged);
  assert.equal(cleared[0].views, ""); assert.equal(cleared[0].sales, ""); assert.equal(cleared[0].trendPercent, "");
  assert.equal(cleared[1].salesSource, undefined); assert.equal(cleared[0].etsyListingId, "1");
});

test("request sends dates and same-origin credentials, sanitizes errors", async () => {
  await requestEtsySales({ shopId: "22", listingIds: ["1"], reportingPeriod: period, fetchImpl: async (url, opts) => {
    assert.equal(new URL(url, "http://test").searchParams.get("endDate"), period.endDate);
    assert.equal(opts.credentials, "same-origin"); assert.equal(opts.cache, "no-store"); return Response.json({});
  } });
  await assert.rejects(requestEtsySales({ shopId: "22", listingIds: ["1"], reportingPeriod: period,
    fetchImpl: async () => Response.json({ message: "private provider information" }, { status: 502 }) }), /Your figures have been kept/);
});

async function serve(t, options) {
  const app = express(); app.use("/api/etsy", createEtsyReadRouter(options));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}/api/etsy/shop/sales?shopId=22&listingIds=1&startDate=2026-09-01&endDate=2026-09-02&connectionId=foreign`;
}
const cookie = { Cookie: "lighthouse_etsy_session=" + "A".repeat(43) };

test("API derives ownership from cookie and denies before readiness/provider calls", async t => {
  let captured;
  const options = { salesImportEnabled: true, getConnectionByOwnerSessionHash: async () => ({ connectionId: "owned", etsyUserId: "11" }),
    getPeriodSales: async args => { captured = args; return { source: "ETSY_RECEIPTS" }; } };
  const url = await serve(t, options);
  assert.equal((await fetch(url)).status, 401); assert.equal(captured, undefined);
  const response = await fetch(url, { headers: cookie }); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(captured.connectionId, "owned");
  assert.equal(captured.etsyUserId, "11"); assert.deepEqual(captured.listingIds, ["1"]);
  const disabled = await serve(t, { ...options, salesImportEnabled: false, getPeriodSales: () => assert.fail() });
  assert.equal((await fetch(disabled, { headers: cookie })).status, 503);
});

test("private sales endpoint respects invitations and the new receipt-processing consent", async t => {
  let etsyUserId = "99", consent = false, called = false;
  const connection = async () => ({ connectionId: "owned", etsyUserId });
  const env = { LIGHTHOUSE_PRIVATE_PILOT: "true", LIGHTHOUSE_PILOT_ETSY_USER_IDS: "11" };
  const access = createPilotAccess({ env, ready: () => true, getConnection: connection, hasConsent: async () => consent });
  const url = await serve(t, { salesImportEnabled: true, pilotAccess: access, getConnectionByOwnerSessionHash: connection,
    getPeriodSales: async () => { called = true; return {}; } });
  assert.equal((await fetch(url, { headers: cookie })).status, 403); assert.equal(called, false);
  etsyUserId = "11";
  assert.equal((await (await fetch(url, { headers: cookie })).json()).error, "PILOT_TERMS_REQUIRED");
  assert.equal(called, false); assert.equal(PILOT_TERMS_VERSION, "2026-09-24-v2");
  consent = true; assert.equal((await fetch(url, { headers: cookie })).status, 200); assert.equal(called, true);
});
