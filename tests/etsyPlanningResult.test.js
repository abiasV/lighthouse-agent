import test from "node:test";
import assert from "node:assert/strict";
import { sampleTrafficPeriod } from "./fixtures/reportingPeriods.js";

import { buildEtsyReadSnapshot } from "../src/integrations/etsy/buildEtsyReadSnapshot.js";

import buildEtsyPlanningResult from "../src/integrations/etsy/buildEtsyPlanningResult.js";

function createWeakConversionSnapshot() {
  return buildEtsyReadSnapshot({
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
}

test("builds shopData, plan, and missingEvidence from the same updated snapshot", () => {
  const snapshot = createWeakConversionSnapshot();

  const result = buildEtsyPlanningResult({
    snapshot,

    sellerInputs: [
      {
        listingId: "listing_1",
        periodViews: 700,
        period: sampleTrafficPeriod,
        periodConfirmed: true,
      },
    ],

    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.shopData.listings[0].views, 700);

  assert.equal(result.plan.tasks.length, 1);

  assert.equal(result.plan.tasks[0].opportunityType, "IMPROVE_CONVERSION");

  assert.equal(result.missingEvidence.length, 0);
});

test("keeps missing traffic visible when seller evidence has not been supplied", () => {
  const snapshot = createWeakConversionSnapshot();

  const result = buildEtsyPlanningResult({
    snapshot,
    sellerInputs: [],
    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.shopData.listings[0].views, null);

  const conversionTask = result.plan.tasks.find(
    (task) => task.opportunityType === "IMPROVE_CONVERSION",
  );

  assert.equal(conversionTask, undefined);

  assert.equal(result.missingEvidence.length, 1);

  assert.equal(result.missingEvidence[0].listingId, "listing_1");

  assert.equal(result.missingEvidence[0].field, "periodViews");
});

test("seller evidence removes the matching missing-evidence gap", () => {
  const snapshot = createWeakConversionSnapshot();

  const withoutSellerEvidence = buildEtsyPlanningResult({
    snapshot,
    sellerInputs: [],
    weeklyAvailableMinutes: 180,
  });

  assert.equal(withoutSellerEvidence.missingEvidence.length, 1);

  const withSellerEvidence = buildEtsyPlanningResult({
    snapshot,

    sellerInputs: [
      {
        listingId: "listing_1",
        periodViews: 700,
        period: sampleTrafficPeriod,
        periodConfirmed: true,
      },
    ],

    weeklyAvailableMinutes: 180,
  });

  assert.equal(withSellerEvidence.missingEvidence.length, 0);
});

test("returns the exact shopData object used to generate the plan", () => {
  const snapshot = createWeakConversionSnapshot();

  const result = buildEtsyPlanningResult({
    snapshot,

    sellerInputs: [
      {
        listingId: "listing_1",
        periodViews: 700,
        period: sampleTrafficPeriod,
        periodConfirmed: true,
      },
    ],

    weeklyAvailableMinutes: 180,
  });

  assert.equal(result.shopData.shopName, "Maya Studio");

  assert.equal(result.shopData.weeklyAvailableMinutes, 180);

  assert.deepEqual(result.shopData.listings[0], {
    id: "listing_1",
    title: "Printable Birthday Invitation",
    views: 700,
    sales: 5,
    trendPercent: 0,
  });
});

test("rejects an invalid Etsy snapshot", () => {
  assert.throws(
    () =>
      buildEtsyPlanningResult({
        snapshot: null,
        sellerInputs: [],
        weeklyAvailableMinutes: 180,
      }),
    {
      message: "INVALID_ETSY_SNAPSHOT",
    },
  );
});

test("rejects seller input for an unknown listing", () => {
  const snapshot = createWeakConversionSnapshot();

  assert.throws(
    () =>
      buildEtsyPlanningResult({
        snapshot,

        sellerInputs: [
          {
            listingId: "missing_listing",
            periodViews: 700,
            period: sampleTrafficPeriod,
            periodConfirmed: true,
          },
        ],

        weeklyAvailableMinutes: 180,
      }),
    {
      message: "SELLER_LISTING_NOT_FOUND",
    },
  );
});

test("rejects negative weekly available minutes", () => {
  const snapshot = createWeakConversionSnapshot();

  assert.throws(
    () =>
      buildEtsyPlanningResult({
        snapshot,
        sellerInputs: [],
        weeklyAvailableMinutes: -30,
      }),
    {
      message: "INVALID_WEEKLY_AVAILABLE_MINUTES",
    },
  );
});

test("rejects non-numeric weekly available minutes", () => {
  const snapshot = createWeakConversionSnapshot();

  assert.throws(
    () =>
      buildEtsyPlanningResult({
        snapshot,
        sellerInputs: [],
        weeklyAvailableMinutes: "180",
      }),
    {
      message: "INVALID_WEEKLY_AVAILABLE_MINUTES",
    },
  );
});
