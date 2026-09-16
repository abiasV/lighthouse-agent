function decideNextAction(state) {
  if (state.agentStatus === "REJECTED") {
    return "STOP";
  }

  if (state.tasks.copyrightCheck.status === "READY") {
    return "CHECK_COPYRIGHT";
  }

  if (state.tasks.demandResearch.status === "READY") {
    return "RESEARCH_DEMAND";
  }

  if (state.tasks.competitionResearch.status === "READY") {
    return "RESEARCH_COMPETITION";
  }

  if (state.tasks.profitabilityInput.status === "READY") {
    return "ASK_PROFITABILITY_INPUT";
  }

  if (state.tasks.profitabilityEvaluation.status === "READY") {
    return "EVALUATE_PROFITABILITY";
  }

  if (state.tasks.effortInput?.status === "READY") {
    return "ASK_EFFORT_INPUT";
  }

  if (state.tasks.effortEvaluation.status === "READY") {
    return "EVALUATE_EFFORT";
  }

  if (state.tasks.scalabilityInput?.status === "READY") {
    return "ASK_SCALABILITY_INPUT";
  }

  if (state.tasks.scalabilityEvaluation.status === "READY") {
    return "EVALUATE_SCALABILITY";
  }

  if (state.tasks.finalEvaluation.status === "READY") {
    return "CALCULATE_FINAL_SCORE";
  }

  if (state.tasks.executionPlanning?.status === "READY") {
    return "GENERATE_EXECUTION_PLAN";
  }

  return "NO_ACTION";
}

export default decideNextAction;
