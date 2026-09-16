function buildAnalysisResponse(analysisId, state) {
  return {
    analysisId,

    idea: state.idea,

    agentStatus: state.agentStatus,

    pendingInput: state.pendingInput,

    finalScore: state.finalScore,

    finalStatus: state.finalStatus,

    finalReason: state.finalReason,

    evidenceCoverage: state.evidenceCoverage ?? null,

    incompleteAnalysis: state.incompleteAnalysis ?? false,

    criteria: state.criteria,

    executionPlan: state.executionPlan ?? null,

    executionPlanningStatus: state.tasks.executionPlanning?.status ?? null,

    executionPlanningBlockedBy:
      state.tasks.executionPlanning?.blockedBy ?? null,

    executionPlanningBlockedReason:
      state.tasks.executionPlanning?.blockedReason ?? null,

    executionPlanningFailureReason:
      state.tasks.executionPlanning?.failureReason ?? null,
  };
}

export default buildAnalysisResponse;
