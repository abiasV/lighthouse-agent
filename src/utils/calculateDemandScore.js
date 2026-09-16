function calculateDemandScore(signals) {
  let score = 0;

  if (signals.strongSearchInterest) {
    score += 3;
  }

  if (signals.commercialIntent) {
    score += 2;
  }

  if (signals.marketplacePurchases) {
    score += 2;
  }

  if (signals.recentSales) {
    score += 2;
  }

  if (signals.positiveTrend) {
    score += 1;
  }

  if (signals.negativeTrend) {
    score -= 1;
  }

  return Math.max(0, Math.min(10, score));
}

export default calculateDemandScore;