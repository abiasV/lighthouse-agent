function createInitialState(idea) {
  return {
    idea,

    agentStatus: "RUNNING",

    researchInputs: {
      competitionQuery: idea,
    },

    mockScenarios: {
      copyright: "PASS",

      demand: "GOOD_DATA",
      demandFallback: "GOOD_DATA",

      competition: "GOOD_DATA",
      competitionFallback: "GOOD_DATA",

      profitability: "GOOD_DATA",

      executionPlan: "GOOD_PLAN",
    },

    tasks: {
      copyrightCheck: {
        status: "READY",
      },

      demandResearch: {
        status: "BLOCKED",
        blockedBy: "copyrightCheck",
      },

      competitionResearch: {
        status: "BLOCKED",
        blockedBy: "demandResearch",
      },

      profitabilityInput: {
        status: "BLOCKED",
        blockedBy: "competitionResearch",
      },

      profitabilityEvaluation: {
        status: "BLOCKED",
        blockedBy: "profitabilityInput",
      },

      effortInput: {
        status: "BLOCKED",
        blockedBy: "profitabilityEvaluation",
      },

      effortEvaluation: {
        status: "BLOCKED",
        blockedBy: "effortInput",
      },

      scalabilityInput: {
        status: "BLOCKED",
        blockedBy: "effortEvaluation",
      },

      scalabilityEvaluation: {
        status: "BLOCKED",
        blockedBy: "scalabilityInput",
      },

      finalEvaluation: {
        status: "BLOCKED",
        blockedBy: "scalabilityEvaluation",
      },

      executionPlanning: {
        status: "BLOCKED",
        blockedBy: "finalEvaluation",
        blockedReason: "WAITING_FOR_FINAL_EVALUATION",
      },
    },

    criteria: {
      demand: {
        score: null,
        confidence: null,
        status: "NOT_STARTED",
        evidence: [],
      },

      competition: {
        score: null,
        confidence: null,
        status: "NOT_STARTED",
        evidence: [],
      },

      profitability: {
        score: null,
        confidence: null,
        status: "NOT_STARTED",
        evidence: [],

        currency: null,
        fixedCost: null,
        sellingPrice: null,
        variableCost: null,
      },

      effort: {
        score: null,
        confidence: null,
        status: "NOT_STARTED",
        evidence: [],
      },

      scalability: {
        score: null,
        confidence: null,
        status: "NOT_STARTED",
        evidence: [],
      },
    },

    executionPlan: null,

    pendingInput: null,

    finalScore: null,
    finalStatus: null,
    finalReason: null,
  };
}

export default createInitialState;
