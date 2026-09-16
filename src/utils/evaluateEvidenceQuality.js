function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function evaluateEvidenceQuality(evidence) {
  const sources = evidence.sources ?? [];

  const uniqueSources = [...new Set(sources)];

  const hostnames = uniqueSources.map(getHostname).filter(Boolean);

  const uniqueDomains = [...new Set(hostnames)];

  let sourceQuality = 35;
  let relevance = 70;
  let freshness = 70;
  let completeness = 60;

  const highTrustDomains = [
    "google.com",
    "trends.google.com",
    "thinkwithgoogle.com",
    "etsy.com",
    "investors.etsy.com",
    "apple.com",
    "businesswire.com",
  ];

  const mediumTrustDomains = [
    "paperlesspost.com",
    "evite.com",
    "partiful.com",
    "rankhero.com",
    "etsyhunt.com",
  ];

  const lowTrustDomains = ["reddit.com", "wikipedia.org"];

  let highTrustCount = 0;
  let mediumTrustCount = 0;
  let lowTrustCount = 0;

  for (const domain of uniqueDomains) {
    if (
      highTrustDomains.some(
        (trustedDomain) =>
          domain === trustedDomain || domain.endsWith(`.${trustedDomain}`),
      )
    ) {
      highTrustCount += 1;
      continue;
    }

    if (
      mediumTrustDomains.some(
        (trustedDomain) =>
          domain === trustedDomain || domain.endsWith(`.${trustedDomain}`),
      )
    ) {
      mediumTrustCount += 1;
      continue;
    }

    if (
      lowTrustDomains.some(
        (trustedDomain) =>
          domain === trustedDomain || domain.endsWith(`.${trustedDomain}`),
      )
    ) {
      lowTrustCount += 1;
    }
  }

  const totalRatedSources = highTrustCount + mediumTrustCount + lowTrustCount;

  if (uniqueSources.length >= 3) {
    sourceQuality += 5;
  }

  if (uniqueDomains.length >= 3) {
    sourceQuality += 5;
  }

  if (uniqueDomains.length >= 5) {
    sourceQuality += 5;
  }

  sourceQuality += highTrustCount * 6;

  sourceQuality += mediumTrustCount * 3;

  sourceQuality -= lowTrustCount * 2;

  if (totalRatedSources > 0) {
    const trustedRatio =
      (highTrustCount + mediumTrustCount) / totalRatedSources;

    if (trustedRatio >= 0.75) {
      sourceQuality += 10;
    } else if (trustedRatio < 0.4) {
      sourceQuality -= 10;
    }
  }

  // Relevance
  if (evidence.type === "REAL_DEMAND_RESEARCH") {
    relevance += 15;
  }

  if (typeof evidence.value === "string" && evidence.value.length > 300) {
    relevance += 5;
  }

  // Freshness
  const currentYear = new Date().getFullYear();

  if (
    typeof evidence.value === "string" &&
    evidence.value.includes(String(currentYear))
  ) {
    freshness += 15;
  }

  // Completeness
  if (uniqueSources.length >= 3) {
    completeness += 10;
  }

  if (uniqueDomains.length >= 3) {
    completeness += 5;
  }

  if (typeof evidence.value === "string" && evidence.value.length > 500) {
    completeness += 10;
  }

  return {
    sourceQuality: clampScore(sourceQuality),

    relevance: clampScore(relevance),

    freshness: clampScore(freshness),

    completeness: clampScore(completeness),
  };
}

export default evaluateEvidenceQuality;