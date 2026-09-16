const SELLER_INPUT_REQUIRED = "SELLER_INPUT_REQUIRED";

function buildMissingEvidence(snapshot) {
  if (!snapshot?.period || !Array.isArray(snapshot.listings)) {
    throw new Error("INVALID_ETSY_SNAPSHOT");
  }

  const missingEvidence = [];

  for (const listing of snapshot.listings) {
    const periodViewsUnavailable =
      listing.availability?.periodViews === "UNAVAILABLE";

    if (periodViewsUnavailable) {
      missingEvidence.push({
        listingId: listing.id,
        listingTitle: listing.title,

        signal: "LOW_CONVERSION_SIGNAL",

        field: "periodViews",

        reason:
          "Conversion analysis is unavailable because period-based traffic is missing.",

        resolution: {
          type: SELLER_INPUT_REQUIRED,
          field: "periodViews",

          period: {
            currentStart: snapshot.period.currentStart,
            currentEndExclusive: snapshot.period.currentEndExclusive,
            timeZone: snapshot.period.timeZone,
          },
        },
      });
    }
  }

  return missingEvidence;
}

export { SELLER_INPUT_REQUIRED, buildMissingEvidence };