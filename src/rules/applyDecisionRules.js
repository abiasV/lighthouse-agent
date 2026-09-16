function applyDecisionRules(
  criteria,
  weightedScore,
  incompleteAnalysis,
) {
  const demandHasScore =
    criteria.demand.score !== null &&
    criteria.demand.score !== undefined &&
    criteria.demand.status !== "N_A";

  if (
    demandHasScore &&
    criteria.demand.score < 4
  ) {
    return {
      finalStatus: "REJECT",
      reason: "DEMAND_HARD_FLOOR",
    };
  }

  const softFloorCriteria = [
    criteria.competition,
    criteria.profitability,
    criteria.effort,
    criteria.scalability,
  ];

  const hasSoftFloorViolation =
    softFloorCriteria.some(
      (criterion) =>
        criterion.score !== null &&
        criterion.score !== undefined &&
        criterion.status !== "N_A" &&
        criterion.score < 4,
    );

  if (hasSoftFloorViolation) {
    return {
      finalStatus: "NEEDS_MORE_RESEARCH",
      reason: "SOFT_FLOOR_TRIGGERED",
    };
  }

  if (weightedScore === null) {
    return {
      finalStatus: "NEEDS_MORE_RESEARCH",
      reason: "INSUFFICIENT_EVIDENCE",
    };
  }

  if (incompleteAnalysis) {
    return {
      finalStatus: "NEEDS_MORE_RESEARCH",
      reason: "INCOMPLETE_ANALYSIS",
    };
  }

  const hasCriticalLowConfidence =
    criteria.demand.confidence === "LOW" ||
    criteria.competition.confidence === "LOW";

  if (hasCriticalLowConfidence) {
    return {
      finalStatus: "NEEDS_MORE_RESEARCH",
      reason: "LOW_CONFIDENCE_IN_CRITICAL_CRITERION",
    };
  }

  if (weightedScore < 4.5) {
    return {
      finalStatus: "REJECT",
      reason: "LOW_WEIGHTED_SCORE",
    };
  }

  if (weightedScore < 7) {
    return {
      finalStatus: "NEEDS_MORE_RESEARCH",
      reason: "MID_WEIGHTED_SCORE",
    };
  }

  return {
    finalStatus: "WORTH_TESTING",
    reason: "SCORE_AND_FLOORS_PASSED",
  };
}

export default applyDecisionRules;