function validateEvidenceQuality(evidence) {
  if (!evidence.quality) {
    return {
      decision: "REJECT",
      reason: "MISSING_QUALITY_DATA",
    };
  }

  const {
    sourceQuality,
    relevance,
    freshness,
    completeness,
  } = evidence.quality;

  if (
    sourceQuality === undefined ||
    relevance === undefined ||
    freshness === undefined ||
    completeness === undefined
  ) {
    return {
      decision: "REJECT",
      reason: "INCOMPLETE_QUALITY_DATA",
    };
  }

  if (relevance < 40) {
    return {
      decision: "ACCEPT_WITH_LOWER_CONFIDENCE",
      reason: "LOW_RELEVANCE",
    };
  }

  if (completeness < 50) {
    return {
      decision: "ACCEPT_WITH_LOWER_CONFIDENCE",
      reason: "LOW_COMPLETENESS",
    };
  }

  if (sourceQuality < 50) {
    return {
      decision: "ACCEPT_WITH_LOWER_CONFIDENCE",
      reason: "LOW_SOURCE_QUALITY",
    };
  }

  return {
    decision: "ACCEPT",
    reason: null,
  };
}

export default validateEvidenceQuality;