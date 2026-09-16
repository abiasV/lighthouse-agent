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

function verifyDeterministicCriterion(criterion, taskResult) {
  if (criterion.description === "At least 10 candidate keywords are provided") {
    const keywordCount = Array.isArray(taskResult?.keywords)
      ? taskResult.keywords.length
      : 0;

    return buildVerificationResult(
      criterion,
      keywordCount >= 10,
      `${keywordCount} keywords were provided`,
      `Only ${keywordCount} keywords were provided`,
    );
  }

  if (criterion.description === "A product title is included") {
    const hasTitle =
      typeof taskResult?.title === "string" &&
      taskResult.title.trim().length > 0;

    return buildVerificationResult(
      criterion,
      hasTitle,
      "A product title was provided",
      "Product title is missing",
    );
  }

  if (criterion.description === "A product description is included") {
    const hasDescription =
      typeof taskResult?.description === "string" &&
      taskResult.description.trim().length > 0;

    return buildVerificationResult(
      criterion,
      hasDescription,
      "A product description was provided",
      "Product description is missing",
    );
  }

  if (
    criterion.description ===
    "Potential conversion problems are identified using the listing data"
  ) {
    const hasIssues =
      Array.isArray(taskResult?.issues) && taskResult.issues.length > 0;

    return buildVerificationResult(
      criterion,
      hasIssues,
      `${taskResult.issues.length} potential conversion problems were identified`,
      "No conversion problems were identified",
    );
  }

  if (
    criterion.description ===
    "No shop changes are made before the decline is diagnosed"
  ) {
    const shopWasNotModified = taskResult?.didModifyShop === false;

    return buildVerificationResult(
      criterion,
      shopWasNotModified,
      "No shop changes were made during diagnosis",
      "The task modified the shop before diagnosis was complete",
    );
  }

  if (
    criterion.description ===
    "No external spending is performed during opportunity validation"
  ) {
    const hasNoExternalSpend = taskResult?.externalSpend === 0;

    return buildVerificationResult(
      criterion,
      hasNoExternalSpend,
      "No external spending was performed",
      "External spending occurred during validation",
    );
  }

  if (criterion.description === "The available shop data is reviewed") {
    const reviewedListingCount = Number(taskResult?.reviewedListingCount) || 0;

    return buildVerificationResult(
      criterion,
      reviewedListingCount > 0,
      `${reviewedListingCount} listings were reviewed`,
      "No listings were reviewed",
    );
  }

  return {
    description: criterion.description,
    evaluationType: criterion.evaluationType,
    status: "FAILED",
    reason: "No deterministic verifier is implemented for this criterion",
  };
}

function verifyAiEvaluatedCriterion(
  criterion,
  taskResult,
  scenario = "GOOD_OUTPUT",
) {
  if (scenario === "IRRELEVANT_KEYWORDS") {
    return {
      description: criterion.description,
      evaluationType: criterion.evaluationType,
      status: "FAILED",
      reason: "Mock AI verifier determined that the keywords are not relevant",
    };
  }

  return {
    description: criterion.description,
    evaluationType: criterion.evaluationType,
    status: "PASSED",
    reason: "Mock AI verifier determined that the output is relevant",
  };
}

function verifyHumanReviewCriterion(criterion) {
  return {
    description: criterion.description,
    evaluationType: criterion.evaluationType,
    status: "WAITING_FOR_HUMAN",
    reason: "Human review is required",
  };
}

function verifyTaskResult(task, taskResult, scenario = "GOOD_OUTPUT") {
  const verificationResults = task.acceptanceCriteria.map((criterion) => {
    if (criterion.evaluationType === "DETERMINISTIC") {
      return verifyDeterministicCriterion(criterion, taskResult);
    }

    if (criterion.evaluationType === "AI_EVALUATED") {
      return verifyAiEvaluatedCriterion(criterion, taskResult, scenario);
    }

    if (criterion.evaluationType === "HUMAN_REVIEW") {
      return verifyHumanReviewCriterion(criterion);
    }

    return {
      description: criterion.description,
      evaluationType: criterion.evaluationType,
      status: "FAILED",
      reason: "Unsupported evaluation type",
    };
  });

  return verificationResults;
}

export default verifyTaskResult;