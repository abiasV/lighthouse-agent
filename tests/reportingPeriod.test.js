import test from "node:test";
import assert from "node:assert/strict";
import { defaultReportingPeriod, normalizeReportingPeriod, validateEtsyReportingPeriod } from "../shared/reportingPeriod.js";
import { buildReportingPeriod, buildEtsyReadSnapshot, attachSellerPeriodViews } from "../src/integrations/etsy/buildEtsyReadSnapshot.js";
import normalizeManualShopData from "../src/utils/normalizeManualShopData.js";

const now = new Date("2026-09-19T01:00:00Z");
const snapshotPeriod = buildReportingPeriod("2026-09-12T18:00:00Z");

test("rolling default excludes today and uses the source zone's calendar day", () => {
  const utc = defaultReportingPeriod("UTC", now);
  assert.equal(utc.endDate, "2026-09-18");
  assert.equal(utc.startDate, "2026-08-20");
  assert.equal(utc.previousEndDate, "2026-08-19");
  const toronto = defaultReportingPeriod("America/Toronto", now);
  assert.equal(toronto.endDate, "2026-09-17");
  assert.equal(toronto.days, 30);
});

test("calendar windows handle leap days, year boundaries, and DST", () => {
  const cases = [
    ["2024-02-01", "2024-02-29", 29, "2024-01-03"],
    ["2025-12-25", "2026-01-07", 14, "2025-12-11"],
    ["2026-03-01", "2026-03-30", 30, "2026-01-30"],
  ];
  for (const [startDate, endDate, days, previousStartDate] of cases) {
    const result = normalizeReportingPeriod({ startDate, endDate, timeZone: "America/Toronto" }, now);
    assert.equal(result.days, days);
    assert.equal(result.previousStartDate, previousStartDate);
  }
});

test("missing, impossible, reversed, current-day, future, and unzoned dates are rejected", () => {
  const valid = { startDate: "2026-08-20", endDate: "2026-09-18", timeZone: "UTC" };
  for (const period of [null, { ...valid, startDate: "2026-02-30" },
    { ...valid, startDate: "2026-09-19" }, { ...valid, endDate: "2026-09-19" },
    { ...valid, endDate: "2027-01-01" }, { ...valid, timeZone: "" },
    { ...valid, timeZone: "Invalid/Zone" }]) {
    assert.throws(() => normalizeReportingPeriod(period, now));
  }
});

test("Etsy windows must be equal, adjacent, full UTC days", () => {
  assert.equal(validateEtsyReportingPeriod(snapshotPeriod, now).endDate, "2026-09-11");
  for (const override of [
    { days: 31 }, { previousEndExclusive: "2026-08-12T00:00:00.000Z" },
    { previousStart: "2026-07-15T00:00:00.000Z" }, { currentStart: "2026-08-13T01:00:00.000Z" },
    { timeZone: "America/Toronto" },
  ]) assert.throws(() => validateEtsyReportingPeriod({ ...snapshotPeriod, ...override }, now));
});

function snapshot() {
  return buildEtsyReadSnapshot({ shop: { id: "s", name: "Test" },
    listings: [{ id: "l", title: "Test listing" }], transactions: [], asOf: "2026-09-12T00:00:00Z" });
}

test("traffic requires matching period, matching zone, explicit confirmation, and a whole count", () => {
  const data = snapshot();
  const input = { listingId: "l", periodViews: 200, period: data.period, periodConfirmed: true };
  assert.equal(attachSellerPeriodViews(data, [input]).listings[0].metrics.periodViews, 200);
  for (const override of [
    { period: undefined }, { periodConfirmed: false },
    { period: { ...data.period, currentStart: "2026-08-14T00:00:00.000Z" } },
    { period: { ...data.period, currentEndExclusive: "2026-09-13T00:00:00.000Z" } },
    { period: { ...data.period, timeZone: "America/Toronto" } },
    { periodViews: null }, { periodViews: "" }, { periodViews: 1.5 }, { periodViews: -1 },
  ]) assert.throws(() => attachSellerPeriodViews(data, [{ ...input, ...override }]));
  assert.equal(data.listings[0].metrics.periodViews, null);
});

test("sales on a period boundary count once, and the incomplete current day is excluded", () => {
  const result = buildEtsyReadSnapshot({ shop: { id: "s", name: "Test" },
    listings: [{ id: "l", title: "Test" }], asOf: "2026-09-12T15:00:00Z",
    transactions: [
      { listingId: "l", createdAt: "2026-07-14T00:00:00Z", quantity: 2 },
      { listingId: "l", createdAt: "2026-08-13T00:00:00Z", quantity: 3 },
      { listingId: "l", createdAt: "2026-09-11T23:59:59Z", quantity: 4 },
      { listingId: "l", createdAt: "2026-09-12T00:00:00Z", quantity: 100 },
    ] });
  assert.equal(result.listings[0].metrics.currentPeriodSales, 7);
  assert.equal(result.listings[0].metrics.previousPeriodSales, 2);
});

test("manual metrics retain the declared period without separate confirmation", () => {
  const data = { shopName: "Test", reportingPeriod: { startDate: "2024-02-01", endDate: "2024-02-29", timeZone: "America/Toronto" },
    weeklyAvailableMinutes: 180, listings: [{ id: "l", title: "Test", views: 200, sales: 5, trendPercent: null }] };
  const normalized = normalizeManualShopData(data);
  assert.equal(normalized.reportingPeriod.days, 29);
  assert.equal(normalized.reportingPeriod.timeZone, "America/Toronto");
  assert.equal(normalized.listings[0].trendPercent, null);
  assert.equal(normalizeManualShopData({ ...data, periodConfirmed: false }).listings.length, 1);
  assert.throws(() => normalizeManualShopData({ ...data, weeklyAvailableMinutes: -1 }));
  assert.throws(() => normalizeManualShopData({ ...data, reportingPeriod: undefined }));
  assert.throws(() => normalizeManualShopData({ ...data, listings: [{ ...data.listings[0], views: null }] }));
});
