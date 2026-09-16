const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DATA_AVAILABILITY = {
  AVAILABLE: "AVAILABLE",
  DERIVED: "DERIVED",
  UNAVAILABLE: "UNAVAILABLE",
};

const DATA_SOURCE = {
  ETSY: "ETSY",
  SELLER_INPUT: "SELLER_INPUT",
  LIGHTHOUSE_DERIVED: "LIGHTHOUSE_DERIVED",
};

function toUtcStartOfDay(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_REPORTING_DATE");
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function buildReportingPeriod(asOf, days = 30) {
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error("INVALID_REPORTING_PERIOD_DAYS");
  }

  const currentEndExclusive = toUtcStartOfDay(asOf);

  const currentStart = new Date(
    currentEndExclusive.getTime() - days * DAY_IN_MS,
  );

  const previousEndExclusive = currentStart;

  const previousStart = new Date(
    previousEndExclusive.getTime() - days * DAY_IN_MS,
  );

  return {
    days,

    currentStart: currentStart.toISOString(),
    currentEndExclusive: currentEndExclusive.toISOString(),

    previousStart: previousStart.toISOString(),
    previousEndExclusive: previousEndExclusive.toISOString(),

    timeZone: "UTC",
  };
}

function isWithinPeriod(timestamp, start, endExclusive) {
  const transactionTime = new Date(timestamp).getTime();
  const startTime = new Date(start).getTime();
  const endTime = new Date(endExclusive).getTime();

  if (Number.isNaN(transactionTime)) {
    return false;
  }

  return transactionTime >= startTime && transactionTime < endTime;
}

function calculateSalesForPeriod(transactions, listingId, start, endExclusive) {
  return transactions
    .filter(
      (transaction) =>
        String(transaction.listingId) === String(listingId) &&
        isWithinPeriod(transaction.createdAt, start, endExclusive),
    )
    .reduce((total, transaction) => {
      const quantity = Number(transaction.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return total;
      }

      return total + quantity;
    }, 0);
}

function calculateTrendPercent(currentSales, previousSales) {
  if (previousSales === 0) {
    return null;
  }

  return ((currentSales - previousSales) / previousSales) * 100;
}

function buildEtsyReadSnapshot({
  shop,
  listings,
  transactions,
  asOf,
  periodDays = 30,
}) {
  if (!shop?.id || !shop?.name) {
    throw new Error("INVALID_ETSY_SHOP");
  }

  if (!Array.isArray(listings)) {
    throw new Error("INVALID_ETSY_LISTINGS");
  }

  if (!Array.isArray(transactions)) {
    throw new Error("INVALID_ETSY_TRANSACTIONS");
  }

  const period = buildReportingPeriod(asOf, periodDays);

  const normalizedListings = listings.map((listing) => {
    const currentPeriodSales = calculateSalesForPeriod(
      transactions,
      listing.id,
      period.currentStart,
      period.currentEndExclusive,
    );

    const previousPeriodSales = calculateSalesForPeriod(
      transactions,
      listing.id,
      period.previousStart,
      period.previousEndExclusive,
    );

    const trendPercent = calculateTrendPercent(
      currentPeriodSales,
      previousPeriodSales,
    );

    return {
      id: String(listing.id),
      title: String(listing.title ?? "").trim(),

      metrics: {
        periodViews: null,
        currentPeriodSales,
        previousPeriodSales,
        trendPercent,
      },

      availability: {
        periodViews: DATA_AVAILABILITY.UNAVAILABLE,
        currentPeriodSales: DATA_AVAILABILITY.AVAILABLE,
        previousPeriodSales: DATA_AVAILABILITY.AVAILABLE,
        trendPercent:
          trendPercent === null
            ? DATA_AVAILABILITY.UNAVAILABLE
            : DATA_AVAILABILITY.DERIVED,
      },

      sources: {
        periodViews: null,
        currentPeriodSales: DATA_SOURCE.ETSY,
        previousPeriodSales: DATA_SOURCE.ETSY,
        trendPercent:
          trendPercent === null ? null : DATA_SOURCE.LIGHTHOUSE_DERIVED,
      },
    };
  });

  return {
    shopId: String(shop.id),
    shopName: String(shop.name).trim(),

    period,

    listings: normalizedListings,
  };
}

function attachSellerPeriodViews(snapshot, sellerInputs) {
  if (!snapshot?.period || !Array.isArray(snapshot.listings)) {
    throw new Error("INVALID_ETSY_SNAPSHOT");
  }

  if (!Array.isArray(sellerInputs)) {
    throw new Error("INVALID_SELLER_INPUTS");
  }

  const sellerInputByListingId = new Map();

  for (const input of sellerInputs) {
    const listingId = String(input?.listingId ?? "");
    const periodViews = Number(input?.periodViews);

    if (!listingId) {
      throw new Error("INVALID_SELLER_LISTING_ID");
    }

    if (!Number.isFinite(periodViews) || periodViews < 0) {
      throw new Error("INVALID_PERIOD_VIEWS");
    }

    sellerInputByListingId.set(listingId, periodViews);
  }

  return {
    ...snapshot,

    listings: snapshot.listings.map((listing) => {
      const periodViews = sellerInputByListingId.get(String(listing.id));

      if (periodViews === undefined) {
        return {
          ...listing,

          metrics: {
            ...listing.metrics,
          },

          availability: {
            ...listing.availability,
          },

          sources: {
            ...listing.sources,
          },
        };
      }

      return {
        ...listing,

        metrics: {
          ...listing.metrics,
          periodViews,
        },

        availability: {
          ...listing.availability,
          periodViews: DATA_AVAILABILITY.AVAILABLE,
        },

        sources: {
          ...listing.sources,
          periodViews: DATA_SOURCE.SELLER_INPUT,
        },
      };
    }),
  };
}

function mapEtsySnapshotToShopData(snapshot, weeklyAvailableMinutes = null) {
  if (!snapshot?.shopName || !Array.isArray(snapshot.listings)) {
    throw new Error("INVALID_ETSY_SNAPSHOT");
  }

  const listings = snapshot.listings.map((listing) => {
    const hasPeriodViews =
      listing.availability?.periodViews === DATA_AVAILABILITY.AVAILABLE;

    const hasTrend =
      listing.availability?.trendPercent === DATA_AVAILABILITY.DERIVED;

    return {
      id: listing.id,
      title: listing.title,

      views: hasPeriodViews ? listing.metrics.periodViews : null,

      sales: listing.metrics.currentPeriodSales,

      trendPercent: hasTrend ? listing.metrics.trendPercent : null,
    };
  });

  return {
    shopName: snapshot.shopName,

    weeklyAvailableMinutes:
      typeof weeklyAvailableMinutes === "number"
        ? weeklyAvailableMinutes
        : null,

    listings,
  };
}

export {
  DATA_AVAILABILITY,
  DATA_SOURCE,
  buildReportingPeriod,
  buildEtsyReadSnapshot,
  attachSellerPeriodViews,
  mapEtsySnapshotToShopData,
  calculateTrendPercent,
};