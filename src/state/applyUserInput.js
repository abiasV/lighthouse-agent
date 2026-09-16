function applyUserInput(state, userInput) {
  if (!state.pendingInput) {
    return state;
  }

  if (state.pendingInput.field === "currency") {
    const currency = String(userInput).trim().toUpperCase();

    if (!["CAD", "USD", "EUR"].includes(currency)) {
      return state;
    }

    state.criteria.profitability.currency = currency;

    state.pendingInput = {
      field: "fixedCost",
      question: "About how much will it cost to get started?",
      expectedType: "currency",
    };

    state.agentStatus = "PAUSED";

    return state;
  }

  if (state.pendingInput.field === "fixedCost") {
    const fixedCost = Number(userInput);

    if (Number.isNaN(fixedCost) || fixedCost < 0) {
      return state;
    }

    state.criteria.profitability.fixedCost = fixedCost;

    if (state.criteria.profitability.inputMode === "REAL") {
      state.pendingInput = {
        field: "sellingPrice",
        question: "What price are you planning to charge per sale?",
        expectedType: "currency",
      };

      state.agentStatus = "PAUSED";

      return state;
    }

    state.tasks.profitabilityInput.status = "COMPLETE";

    state.tasks.profitabilityEvaluation.status = "READY";

    state.tasks.profitabilityEvaluation.blockedBy = null;

    state.pendingInput = null;
    state.agentStatus = "RUNNING";

    return state;
  }

  if (state.pendingInput.field === "sellingPrice") {
    const sellingPrice = Number(userInput);

    if (Number.isNaN(sellingPrice) || sellingPrice <= 0) {
      return state;
    }

    state.criteria.profitability.sellingPrice = sellingPrice;

    state.pendingInput = {
      field: "variableCost",
      question: "About how much does each sale cost you to fulfill?",
      expectedType: "currency",
    };

    state.agentStatus = "PAUSED";

    return state;
  }

  if (state.pendingInput.field === "variableCost") {
    const variableCost = Number(userInput);

    if (Number.isNaN(variableCost) || variableCost < 0) {
      return state;
    }

    state.criteria.profitability.variableCost = variableCost;

    state.tasks.profitabilityInput.status = "COMPLETE";

    state.tasks.profitabilityEvaluation.status = "READY";

    state.tasks.profitabilityEvaluation.blockedBy = null;

    state.pendingInput = null;
    state.agentStatus = "RUNNING";

    return state;
  }

  if (state.pendingInput.field === "minutesPerOrder") {
    const minutesPerOrder = Number(userInput);

    if (Number.isNaN(minutesPerOrder) || minutesPerOrder < 0) {
      return state;
    }

    state.criteria.effort.minutesPerOrder = minutesPerOrder;

    state.pendingInput = {
      field: "humanDependencyChoice",
      question: "How much does each order depend on you personally?",
      expectedType: "humanDependencyChoice",
    };

    state.agentStatus = "PAUSED";

    return state;
  }

  if (state.pendingInput.field === "humanDependencyChoice") {
    const choice = String(userInput).trim().toUpperCase();

    const dependencyMap = {
      "VERY LITTLE": "LOW",
      SOMEWHAT: "MEDIUM",
      "A LOT": "HIGH",
    };

    const humanDependency = dependencyMap[choice];

    if (!humanDependency) {
      return state;
    }

    state.criteria.effort.humanDependency = humanDependency;

    state.tasks.effortInput.status = "COMPLETE";

    state.tasks.effortEvaluation.status = "READY";

    state.tasks.effortEvaluation.blockedBy = null;

    state.pendingInput = null;
    state.agentStatus = "RUNNING";

    return state;
  }

  if (state.pendingInput.field === "parallelOrders") {
    const parallelOrders = Number(userInput);

    if (Number.isNaN(parallelOrders) || parallelOrders <= 0) {
      return state;
    }

    const minutesPerOrder = state.criteria.effort.minutesPerOrder;

    if (
      typeof minutesPerOrder !== "number" ||
      Number.isNaN(minutesPerOrder) ||
      minutesPerOrder < 0
    ) {
      return state;
    }

    const ordersPerHourWithoutExtraHelp =
      minutesPerOrder === 0
        ? 20
        : Math.max(1, Math.floor((60 / minutesPerOrder) * parallelOrders));

    state.criteria.scalability.parallelOrders = parallelOrders;

    state.criteria.scalability.ordersPerHourWithoutExtraHelp =
      ordersPerHourWithoutExtraHelp;

    const humanDependency = state.criteria.effort.humanDependency;

    let manualBottleneckLevel = "MEDIUM";

    if (humanDependency === "LOW") {
      manualBottleneckLevel = "LOW";
    } else if (humanDependency === "HIGH") {
      manualBottleneckLevel = "HIGH";
    }

    state.criteria.scalability.manualBottleneckLevel = manualBottleneckLevel;

    state.tasks.scalabilityInput.status = "COMPLETE";

    state.tasks.scalabilityEvaluation.status = "READY";

    state.tasks.scalabilityEvaluation.blockedBy = null;

    state.pendingInput = null;
    state.agentStatus = "RUNNING";

    return state;
  }

  if (state.pendingInput.field === "competitionQuery") {
    const correctedQuery = String(userInput).trim();

    if (!correctedQuery) {
      return state;
    }

    state.researchInputs.competitionQuery = correctedQuery;

    state.criteria.competition.score = null;
    state.criteria.competition.confidence = null;
    state.criteria.competition.status = "NOT_STARTED";

    state.criteria.competition.evidence = [];

    delete state.criteria.competition.failureReason;

    delete state.criteria.competition.usedFallback;

    state.tasks.competitionResearch.status = "READY";

    state.tasks.competitionResearch.blockedBy = null;

    state.pendingInput = null;
    state.agentStatus = "RUNNING";

    return state;
  }

  return state;
}

export default applyUserInput;
