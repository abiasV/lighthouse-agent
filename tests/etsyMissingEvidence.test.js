import test from "node:test";
import assert from "node:assert/strict";

import {
  attachSellerPeriodViews,
  buildEtsyReadSnapshot,
} from "../src/integrations/etsy/buildEtsyReadSnapshot.js";

import {
  SELLER_INPUT_REQUIRED,
  buildMissingEvidence,
} from "../src/integrations/etsy/buildMissingEvidence.js";

function createSnapshot() {
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
      {
        id: "listing_2",
        title: "Meal Planner Bundle",
      },
    ],

    transactions: [],

    asOf: "2026-09-12T15:30:00Z",
  });
}

test("reports missing period traffic as a blocked conversion analysis requirement", () => {
  const snapshot = createSnapshot();

  const missingEvidence = buildMissingEvidence(snapshot);

  assert.equal(missingEvidence.length, 2);

  assert.deepEqual(missingEvidence[0], {
    listingId: "listing_1",
    listingTitle: "Printable Birthday Invitation",

    signal: "LOW_CONVERSION_SIGNAL",

    field: "periodViews",

    reason:
      "Conversion analysis is unavailable because period-based traffic is missing.",

    resolution: {
      type: SELLER_INPUT_REQUIRED,
      field: "periodViews",

      period: {
        currentStart: "2026-08-13T00:00:00.000Z",
        currentEndExclusive: "2026-09-12T00:00:00.000Z",
        timeZone: "UTC",
      },
    },
  });
});

test("does not report period traffic as missing after seller supplies it", () => {
  const snapshot = createSnapshot();

  const updatedSnapshot = attachSellerPeriodViews(snapshot, [
    {
      listingId: "listing_1",
      periodViews: 700,
    },
  ]);

  const missingEvidence = buildMissingEvidence(updatedSnapshot);

  assert.equal(missingEvidence.length, 1);

  assert.equal(missingEvidence[0].listingId, "listing_2");
});

test("missing conversion evidence does not claim that a conversion problem exists", () => {
  const snapshot = createSnapshot();

  const missingEvidence = buildMissingEvidence(snapshot);

  assert.equal(
    missingEvidence[0].reason,
    "Conversion analysis is unavailable because period-based traffic is missing.",
  );

  assert.notEqual(
    missingEvidence[0].reason,
    "This listing has a conversion problem.",
  );
});