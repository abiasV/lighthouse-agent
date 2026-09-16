function qualityToConfidence(quality) {
  const { sourceQuality, relevance, freshness, completeness } = quality;

  const average = (sourceQuality + relevance + freshness + completeness) / 4;

  if (average >= 85) {
    return "HIGH";
  }

  if (average >= 70) {
    return "MEDIUM";
  }

  return "LOW";
}

export default qualityToConfidence;