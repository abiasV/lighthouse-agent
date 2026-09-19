import test from "node:test";
import assert from "node:assert/strict";
import { sampleTrafficPeriod } from "./fixtures/reportingPeriods.js";

import {
  attachSellerPeriodViews,
  buildEtsyReadSnapshot,
  mapEtsySnapshotToShopData,
} from "../src/integrations/etsy/buildEtsyReadSnapshot.js";

import generateExecutionPlan from "../src/tools/generateExecutionPlan.js";

test("seller traffic evidence enables low-conversion detection", () => {
  const snapshot = buildEtsyReadSnapshot({
    shop: {
      id: "shop_1",
      name: "Maya Studio",
    },

    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",
      },
    ],

    transactions: [
      {
        listingId: "listing_1",
        quantity: 5,
        createdAt: "2026-08-20T12:00:00Z",
      },

      {
        listingId: "listing_1",
        quantity: 5,
        createdAt: "2026-07-20T12:00:00Z",
      },
    ],

    asOf: "2026-09-12T15:30:00Z",
  });

  const snapshotWithTraffic = attachSellerPeriodViews(snapshot, [
    {
      listingId: "listing_1",
      periodViews: 700,
      period: sampleTrafficPeriod,
      periodConfirmed: true,
    },
  ]);

  const shopData = mapEtsySnapshotToShopData(snapshotWithTraffic, 180);

  const plan = generateExecutionPlan(shopData);

  assert.equal(plan.tasks.length, 1);

  assert.equal(plan.tasks[0].opportunityType, "IMPROVE_CONVERSION");

  assert.equal(plan.tasks[0].riskLevel, "APPROVAL_REQUIRED");
});

test("missing traffic blocks low-conversion detection without blocking decline diagnosis", () => {
  const snapshot = buildEtsyReadSnapshot({
    shop: {
      id: "shop_1",
      name: "Maya Studio",
    },

    listings: [
      {
        id: "listing_1",
        title: "Meal Planner Bundle",
      },
    ],

    transactions: [
      {
        listingId: "listing_1",
        quantity: 34,
        createdAt: "2026-08-20T12:00:00Z",
      },

      {
        listingId: "listing_1",
        quantity: 50,
        createdAt: "2026-07-20T12:00:00Z",
      },
    ],

    asOf: "2026-09-12T15:30:00Z",
  });

  const shopData = mapEtsySnapshotToShopData(snapshot, 180);

  assert.equal(shopData.listings[0].views, null);

  assert.equal(shopData.listings[0].sales, 34);

  assert.equal(shopData.listings[0].trendPercent, -32);

  const plan = generateExecutionPlan(shopData);

  assert.equal(plan.tasks.length, 1);

  assert.equal(plan.tasks[0].opportunityType, "DIAGNOSE_DECLINE");

  assert.equal(plan.tasks[0].riskLevel, "SAFE_AUTOMATION");
});
