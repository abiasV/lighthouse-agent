import "dotenv/config";

import createInitialState from "../src/state/createInitialState.js";
import runAgent from "../src/agent/runAgent.js";
import applyUserInput from "../src/state/applyUserInput.js";

import generateReport from "../src/utils/generateReport.js";
import formatReport from "../src/utils/formatReport.js";

const runRealApiTest = process.env.RUN_REAL_API_TEST === "true";

const options = {
  useRealDemand: runRealApiTest,
  useRealCompetition: runRealApiTest,

  useRealProfitability: true,
  useRealEffort: true,
  useRealScalability: true,

  sleepFn: async () => {},
};

const testAnswers = {
  currency: "CAD",

  fixedCost: "50",

  sellingPrice: "8",

  variableCost: "1",

  minutesPerOrder: "15",

  humanDependencyChoice: "VERY LITTLE",

  parallelOrders: "5",
};

let state = createInitialState("Birthday Invitation");

function printCompetitionTrace() {
  const competition = state.criteria.competition;

  const evidenceItem = competition.evidence?.[0] ?? null;

  const sources = evidenceItem?.sources ?? [];

  const researchSummary = evidenceItem?.value ?? null;

  console.log("\n=== COMPETITION TRACE ===");

  console.log("\nQuery:");

  console.log(state.researchInputs.competitionQuery);

  console.log("\nSources:");

  if (sources.length > 0) {
    sources.forEach((source, index) => {
      console.log(`${index + 1}. ${source}`);
    });
  } else {
    console.log("No source URLs available.");
  }

  console.log("\nResearch Summary:");

  if (researchSummary) {
    console.log(researchSummary);
  } else {
    console.log("No research summary available.");
  }

  console.log("\nExtracted Signals:");

  if (competition.signals) {
    console.dir(competition.signals, {
      depth: null,
    });
  } else {
    console.log("No extracted signals available.");
  }

  console.log("\nCompetition Score:");

  console.log(competition.score);

  console.log("\n=== NICHE MATCH REVIEW ===");

  console.log("Review these questions manually:");

  console.log("1. Do the sources discuss the exact product niche?");

  console.log("2. Are any sources about a broader adjacent market?");

  console.log(
    "3. Does the research summary preserve the same niche as the query?",
  );

  console.log(
    "4. Are the extracted competition signals directly supported by the sources and summary?",
  );
}

async function continueAgent() {
  state = await runAgent(state, options);
}

function answerPendingInput() {
  if (!state.pendingInput) {
    return false;
  }

  const field = state.pendingInput.field;

  const value = testAnswers[field];

  if (value === undefined) {
    throw new Error(`No test answer configured for pending field: ${field}`);
  }

  console.log(`\nAnswering ${field}: ${value}`);

  state = applyUserInput(state, value);

  return true;
}

console.log("\n=== FINAL LIGHTHOUSE TEST ===");

if (runRealApiTest) {
  console.log("\n=== REAL API TEST ===");

  console.log("\nExpected top-level OpenAI requests: 4");
} else {
  console.log("\n=== FREE TEST ===");

  console.log("\nOpenAI API requests: 0");
}

console.log("Planner mode: MOCK / FREE");

// Start the agent.
//
// In REAL mode:
// - Copyright check
// - REAL Demand research
// - REAL Competition research
//
// In FREE mode:
// - Copyright check
// - MOCK Demand research
// - MOCK Competition research
//
// Then the agent pauses for user input.
await continueAgent();

// Continue answering Smart Question Flow
// until the agent reaches a terminal state.
while (state.agentStatus === "PAUSED") {
  answerPendingInput();

  await continueAgent();
}

console.log("\n=== FINAL CRITERIA ===");

console.log({
  demand: {
    score: state.criteria.demand.score,

    confidence: state.criteria.demand.confidence,

    status: state.criteria.demand.status,
  },

  competition: {
    score: state.criteria.competition.score,

    confidence: state.criteria.competition.confidence,

    status: state.criteria.competition.status,
  },

  profitability: {
    score: state.criteria.profitability.score,

    confidence: state.criteria.profitability.confidence,

    status: state.criteria.profitability.status,
  },

  effort: {
    score: state.criteria.effort.score,

    confidence: state.criteria.effort.confidence,

    status: state.criteria.effort.status,
  },

  scalability: {
    score: state.criteria.scalability.score,

    confidence: state.criteria.scalability.confidence,

    status: state.criteria.scalability.status,
  },
});

printCompetitionTrace();

console.log("\n=== FINAL RESULT ===");

console.log({
  agentStatus: state.agentStatus,

  finalScore: state.finalScore,

  finalStatus: state.finalStatus,

  finalReason: state.finalReason,

  evidenceCoverage: state.evidenceCoverage,

  incompleteAnalysis: state.incompleteAnalysis,
});

console.log("\n=== EXECUTION PLANNING ===");

console.log({
  planningStatus: state.tasks.executionPlanning?.status ?? null,

  planningBlockedBy: state.tasks.executionPlanning?.blockedBy ?? null,

  planningBlockedReason: state.tasks.executionPlanning?.blockedReason ?? null,

  planningFailureReason: state.tasks.executionPlanning?.failureReason ?? null,
});

console.log("\n=== EXECUTION PLAN ===");

if (state.executionPlan) {
  console.dir(state.executionPlan, {
    depth: null,
  });
} else {
  console.log("No execution plan was generated.");
}

if (state.agentStatus === "COMPLETE" || state.agentStatus === "REJECTED") {
  const report = generateReport(state);

  console.log("\n=== FINAL LIGHTHOUSE REPORT ===");

  console.log(formatReport(report));
}

if (state.agentStatus === "PLANNING_FAILED") {
  console.log("\nExecution planning failed.");

  console.log(
    "Reason:",
    state.tasks.executionPlanning?.failureReason ?? "UNKNOWN",
  );
}

console.log("\n=== FINAL TEST FINISHED ===");

process.exit(0);