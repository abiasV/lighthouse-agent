import validateEvidenceQuality from "./validateEvidenceQuality.js";

function validateEvidenceResult(result) {
  if (!result) {
    return {
      valid: false,
      reason: "NO_RESULT",
    };
  }

  if (!Array.isArray(result.evidence)) {
    return {
      valid: false,
      reason: "EVIDENCE_NOT_ARRAY",
    };
  }

  if (result.evidence.length === 0) {
    return {
      valid: false,
      reason: "NO_EVIDENCE",
    };
  }

  if (result.score === null || result.score === undefined) {
    return {
      valid: false,
      reason: "MISSING_SCORE",
    };
  }

  if (!result.confidence) {
    return {
      valid: false,
      reason: "MISSING_CONFIDENCE",
    };
  }

  for (const evidence of result.evidence) {
    const qualityResult = validateEvidenceQuality(evidence);

    if (qualityResult.decision === "REJECT") {
      return {
        valid: false,
        reason: qualityResult.reason,
      };
    }

    if (
      qualityResult.decision ===
      "ACCEPT_WITH_LOWER_CONFIDENCE"
    ) {
      return {
        valid: true,
        lowerConfidence: true,
        reason: qualityResult.reason,
      };
    }
  }

  return {
    valid: true,
    lowerConfidence: false,
    reason: null,
  };
}

export default validateEvidenceResult;