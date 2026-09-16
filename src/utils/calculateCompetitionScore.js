function calculateCompetitionScore(signals) {
  let score = 10;

  if (signals.highListingDensity) {
    score -= 2;
  }

  if (signals.strongEstablishedCompetitors) {
    score -= 2;
  }

  if (signals.highMarketplaceSaturation) {
    score -= 2;
  }

  if (signals.difficultDifferentiation) {
    score -= 2;
  }

  if (signals.clearDifferentiationOpportunity) {
    score += 1;
  }

  return Math.max(0, Math.min(10, score));
}

export default calculateCompetitionScore;