import test from "node:test";
import assert from "node:assert/strict";
import { sampleTrafficPeriod } from "./fixtures/reportingPeriods.js";

import {
  DATA_AVAILABILITY,
  DATA_SOURCE,
  buildEtsyReadSnapshot,
  buildReportingPeriod,
  attachSellerPeriodViews,
  mapEtsySnapshotToShopData,
  calculateTrendPercent,
} from "../src/integrations/etsy/buildEtsyReadSnapshot.js";

test("builds two aligned 30-day UTC reporting windows", () => {
  const period = buildReportingPeriod("2026-09-12T15:30:00Z");

  assert.deepEqual(period, {
    days: 30,

    currentStart: "2026-08-13T00:00:00.000Z",
    currentEndExclusive: "2026-09-12T00:00:00.000Z",

    previousStart: "2026-07-14T00:00:00.000Z",
    previousEndExclusive: "2026-08-13T00:00:00.000Z",

    timeZone: "UTC",
  });
});

test("calculates current and previous sales for the same listing", () => {
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
        quantity: 3,
        createdAt: "2026-08-20T12:00:00Z",
      },
      {
        listingId: "listing_1",
        quantity: 2,
        createdAt: "2026-09-01T12:00:00Z",
      },

      {
        listingId: "listing_1",
        quantity: 4,
        createdAt: "2026-07-20T12:00:00Z",
      },
      {
        listingId: "listing_1",
        quantity: 4,
        createdAt: "2026-08-05T12:00:00Z",
      },
    ],

    asOf: "2026-09-12T15:30:00Z",
  });

  const listing = snapshot.listings[0];

  assert.equal(listing.metrics.currentPeriodSales, 5);
  assert.equal(listing.metrics.previousPeriodSales, 8);

  assert.equal(listing.metrics.trendPercent, -37.5);
});

test("keeps period views unavailable until seller evidence exists", () => {
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

    transactions: [],

    asOf: "2026-09-12T15:30:00Z",
  });

  const listing = snapshot.listings[0];

  assert.equal(listing.metrics.periodViews, null);

  assert.equal(listing.availability.periodViews, DATA_AVAILABILITY.UNAVAILABLE);

  assert.equal(listing.sources.periodViews, null);
});

test("marks sales as Etsy evidence and trend as Lighthouse-derived", () => {
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
        quantity: 8,
        createdAt: "2026-08-20T12:00:00Z",
      },
      {
        listingId: "listing_1",
        quantity: 10,
        createdAt: "2026-07-20T12:00:00Z",
      },
    ],

    asOf: "2026-09-12T15:30:00Z",
  });

  const listing = snapshot.listings[0];

  assert.equal(
    listing.availability.currentPeriodSales,
    DATA_AVAILABILITY.AVAILABLE,
  );

  assert.equal(listing.sources.currentPeriodSales, DATA_SOURCE.ETSY);

  assert.equal(listing.availability.trendPercent, DATA_AVAILABILITY.DERIVED);

  assert.equal(listing.sources.trendPercent, DATA_SOURCE.LIGHTHOUSE_DERIVED);
});

test("does not invent a trend when previous-period sales are zero", () => {
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
    ],

    asOf: "2026-09-12T15:30:00Z",
  });

  const listing = snapshot.listings[0];

  assert.equal(listing.metrics.currentPeriodSales, 5);
  assert.equal(listing.metrics.previousPeriodSales, 0);

  assert.equal(listing.metrics.trendPercent, null);

  assert.equal(
    listing.availability.trendPercent,
    DATA_AVAILABILITY.UNAVAILABLE,
  );

  assert.equal(listing.sources.trendPercent, null);
});

test("calculateTrendPercent returns null when the previous period is zero", () => {
  assert.equal(calculateTrendPercent(5, 0), null);
});

test("attaches seller period views without mutating the original snapshot", () => {
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

    transactions: [],

    asOf: "2026-09-12T15:30:00Z",
  });

  const updatedSnapshot = attachSellerPeriodViews(snapshot, [
    {
      listingId: "listing_1",
      periodViews: 700,
      period: sampleTrafficPeriod,
      periodConfirmed: true,
    },
  ]);

  assert.equal(snapshot.listings[0].metrics.periodViews, null);

  assert.equal(
    snapshot.listings[0].availability.periodViews,
    DATA_AVAILABILITY.UNAVAILABLE,
  );

  assert.equal(updatedSnapshot.listings[0].metrics.periodViews, 700);

  assert.equal(
    updatedSnapshot.listings[0].availability.periodViews,
    DATA_AVAILABILITY.AVAILABLE,
  );

  assert.equal(
    updatedSnapshot.listings[0].sources.periodViews,
    DATA_SOURCE.SELLER_INPUT,
  );
});

test("leaves listings without seller traffic evidence unavailable", () => {
  const snapshot = buildEtsyReadSnapshot({
    shop: {
      id: "shop_1",
      name: "Maya Studio",
    },

    listings: [
      {
        id: "listing_1",
        title: "Listing One",
      },
      {
        id: "listing_2",
        title: "Listing Two",
      },
    ],

    transactions: [],

    asOf: "2026-09-12T15:30:00Z",
  });

  const updatedSnapshot = attachSellerPeriodViews(snapshot, [
    {
      listingId: "listing_1",
      periodViews: 500,
      period: sampleTrafficPeriod,
      periodConfirmed: true,
    },
  ]);

  assert.equal(
    updatedSnapshot.listings[0].availability.periodViews,
    DATA_AVAILABILITY.AVAILABLE,
  );

  assert.equal(
    updatedSnapshot.listings[1].availability.periodViews,
    DATA_AVAILABILITY.UNAVAILABLE,
  );

  assert.equal(updatedSnapshot.listings[1].metrics.periodViews, null);
});

test("maps available seller traffic and Etsy sales into the existing shop schema", () => {
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
        quantity: 10,
        createdAt: "2026-07-20T12:00:00Z",
      },
    ],

    asOf: "2026-09-12T15:30:00Z",
  });

  const withSellerViews = attachSellerPeriodViews(snapshot, [
    {
      listingId: "listing_1",
      periodViews: 700,
      period: sampleTrafficPeriod,
      periodConfirmed: true,
    },
  ]);

  const shopData = mapEtsySnapshotToShopData(withSellerViews, 180);

  assert.deepEqual(shopData, {
    reportingPeriod: {
      startDate: "2026-08-13", endDate: "2026-09-11", timeZone: "UTC", days: 30,
      previousStartDate: "2026-07-14", previousEndDate: "2026-08-12",
    },
    shopName: "Maya Studio",

    weeklyAvailableMinutes: 180,

    listings: [
      {
        id: "listing_1",
        title: "Printable Birthday Invitation",
        views: 700,
        sales: 5,
        trendPercent: -50,
      },
    ],
  });
});

test("maps unavailable traffic to null instead of zero", () => {
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
    ],

    asOf: "2026-09-12T15:30:00Z",
  });

  const shopData = mapEtsySnapshotToShopData(snapshot, 180);

  assert.equal(shopData.listings[0].views, null);
  assert.equal(shopData.listings[0].sales, 5);
  assert.equal(shopData.listings[0].trendPercent, null);
});
