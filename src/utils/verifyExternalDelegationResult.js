function buildVerificationResult(
  criterion,
  passed,
  passedReason,
  failedReason,
) {
  return {
    description: criterion.description,

    evaluationType: criterion.evaluationType,

    status: passed ? "PASSED" : "FAILED",

    reason: passed ? passedReason : failedReason,
  };
}

function verifyProductFacts(criterion, task, result) {
  const verifiedFacts = task.delegation?.verifiedFacts ?? {};

  const usedFacts = result?.productFactsUsed ?? {};

  const unverifiedFacts = Object.entries(usedFacts).filter(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(verifiedFacts, key)) {
      return true;
    }

    return verifiedFacts[key] !== value;
  });

  return buildVerificationResult(
    criterion,

    unverifiedFacts.length === 0,

    "All product facts used in the deliverable match seller-verified facts.",

    unverifiedFacts.length > 0
      ? `Unverified product facts were detected: ${unverifiedFacts
          .map(([key]) => key)
          .join(", ")}.`
      : "The deliverable contains unverified product facts.",
  );
}

function verifySourceFiles(criterion, result) {
  const files = Array.isArray(result?.files) ? result.files : [];

  const hasSourceFile = files.some((file) => file.type === "SOURCE_FILE");

  return buildVerificationResult(
    criterion,

    hasSourceFile,

    "The required editable source file is included.",

    "The required editable source file is missing.",
  );
}

function verifyTaskMatch(criterion, result) {
  return buildVerificationResult(
    criterion,

    result?.taskMatch === true,

    "The deliverable matches the requested task.",

    "The deliverable does not match the requested task.",
  );
}

function verifyCopyrightSafety(criterion, result) {
  return buildVerificationResult(
    criterion,

    result?.copyrightCheck?.passed === true,

    "No prohibited copyrighted characters or protected brands were detected.",

    "The deliverable failed the copyright or brand safety check.",
  );
}

function verifyExternalDelegationResult(task, result) {
  if (!task || task.executorType !== "EXTERNAL") {
    throw new Error("EXTERNAL_TASK_REQUIRED");
  }

  if (!result) {
    throw new Error("EXTERNAL_DELIVERABLE_REQUIRED");
  }

  return task.acceptanceCriteria.map((criterion) => {
    if (criterion.description === "Deliverables match the requested task") {
      return verifyTaskMatch(criterion, result);
    }

    if (
      criterion.description ===
      "All product facts used in the brief and accepted deliverable come from verified facts"
    ) {
      return verifyProductFacts(criterion, task, result);
    }

    if (
      criterion.description === "No copyrighted characters or brands are used"
    ) {
      return verifyCopyrightSafety(criterion, result);
    }

    if (criterion.description === "Required source files are included") {
      return verifySourceFiles(criterion, result);
    }

    return {
      description: criterion.description,

      evaluationType: criterion.evaluationType,

      status: "FAILED",

      reason:
        "No external deliverable verifier is implemented for this criterion.",
    };
  });
}

export default verifyExternalDelegationResult;