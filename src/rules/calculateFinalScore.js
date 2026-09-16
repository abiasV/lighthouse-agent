function calculateFinalScore(criteria) {
  const weights = {
    demand: 0.3,
    competition: 0.2,
    effort: 0.2,
    profitability: 0.2,
    scalability: 0.1,
  };

  let weightedTotal = 0;
  let availableWeight = 0;

  for (const [criterionName, weight] of Object.entries(weights)) {
    const criterion = criteria[criterionName];

    if (
      criterion.score === null ||
      criterion.score === undefined ||
      criterion.status === "N_A"
    ) {
      continue;
    }

    weightedTotal += criterion.score * weight;
    availableWeight += weight;
  }

  if (availableWeight === 0) {
    return {
      score: null,
      coverage: 0,
      incomplete: true,
    };
  }

  const normalizedScore =
    weightedTotal / availableWeight;

  const coverage =
    Math.round(availableWeight * 100);

  return {
    score: Number(normalizedScore.toFixed(2)),
    coverage,
    incomplete: coverage < 100,
  };
}

export default calculateFinalScore;