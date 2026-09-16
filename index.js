import "dotenv/config";

import createInitialState from "./src/state/createInitialState.js";
import runAgent from "./src/agent/runAgent.js";
import applyUserInput from "./src/state/applyUserInput.js";

import generateReport from "./src/utils/generateReport.js";
import formatReport from "./src/utils/formatReport.js";

import explainReport from "./src/agent/explainReport.js";
import explainReportWithAI from "./src/agent/explainReportWithAI.js";

const USE_AI_EXPLANATION = false;

let state = createInitialState("Birthday Invitation");

// Mock scenarios for this run
state.mockScenarios.demand = "GOOD_DATA";
state.mockScenarios.demandFallback = "GOOD_DATA";

state.mockScenarios.competition = "GOOD_DATA";
state.mockScenarios.competitionFallback = "GOOD_DATA";

state.mockScenarios.profitability = "GOOD_DATA";

// First run
state = await runAgent(state, {
  useRealDemand: true,
  useRealCompetition: true,
});

console.log("\nState after first run:");

console.dir(state, {
  depth: null,
});

// If the Agent asks for a corrected competition query
if (state.pendingInput?.field === "competitionQuery") {
  console.log("\nSimulating corrected competition query...");

  state.mockScenarios.competition = "GOOD_DATA";

  state = applyUserInput(
    state,
    "Editable digital birthday invitation template",
  );

  state = await runAgent(state);

  console.log("\nState after competition query correction:");

  console.dir(state, {
    depth: null,
  });
}

// If the Agent asks for fixed cost
if (state.pendingInput?.field === "fixedCost") {
  console.log("\nSimulating fixed cost response...");

  state = applyUserInput(state, "50");

  state = await runAgent(state);

  console.log("\nFinal state:");

  console.dir(state, {
    depth: null,
  });
}

// Create a clean user-facing report object
if (state.agentStatus === "COMPLETE" || state.agentStatus === "REJECTED") {
  const report = generateReport(state);
  console.log("\nLighthouse Report:");
  console.dir(report, {
    depth: null,
  });

  const formattedReport = formatReport(report);

  console.log("\nFormatted Lighthouse Report:");
  console.log(formattedReport);

  // Mock Explanation
  const mockExplanation = explainReport(report);

  console.log("\nMock Lighthouse Explanation:");
  console.log(mockExplanation);

  // AI Explanation
  if (USE_AI_EXPLANATION) {
    console.log("\nCalling OpenAI API for explanation...");

    const aiExplanation = await explainReportWithAI(report);

    console.log("\nAI Lighthouse Explanation:");
    console.log(aiExplanation);
  } else {
    console.log("\nAI explanation skipped to avoid API cost.");
  }

  console.log("\nLighthouse finished.");

  process.exit(0);
}
