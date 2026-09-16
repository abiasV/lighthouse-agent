function generateReport(state) {
  return {
    idea: state.idea,

    score: state.finalScore,

    recommendation: state.finalStatus,

    reason: state.finalReason,

    evidenceCoverage:
      state.evidenceCoverage ?? null,

    incompleteAnalysis:
      state.incompleteAnalysis ?? false,

    criteria: {
      demand: {
        score: state.criteria.demand.score,
        confidence:
          state.criteria.demand.confidence,
        status:
          state.criteria.demand.status,
      },

      competition: {
        score:
          state.criteria.competition.score,
        confidence:
          state.criteria.competition.confidence,
        status:
          state.criteria.competition.status,
      },

      profitability: {
        score:
          state.criteria.profitability.score,
        confidence:
          state.criteria.profitability.confidence,
        status:
          state.criteria.profitability.status,
      },

      effort: {
        score: state.criteria.effort.score,
        confidence:
          state.criteria.effort.confidence,
        status:
          state.criteria.effort.status,
      },

      scalability: {
        score:
          state.criteria.scalability.score,
        confidence:
          state.criteria.scalability.confidence,
        status:
          state.criteria.scalability.status,
      },
    },
  };
}

export default generateReport;