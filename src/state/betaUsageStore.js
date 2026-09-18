function createBetaUsageStore() {
  const runsByTester = new Map();
  let totalRuns = 0;

  return {
    getTesterRuns(testerId) {
      return runsByTester.get(testerId) ?? 0;
    },

    getTotalRuns() {
      return totalRuns;
    },

    reserveRun(testerId, { maxRunsPerTester, maxTotalRuns }) {
      const testerRuns = runsByTester.get(testerId) ?? 0;

      if (testerRuns >= maxRunsPerTester) {
        return {
          allowed: false,
          reason: "BETA_TESTER_RUN_LIMIT_REACHED",
          testerRuns,
          totalRuns,
        };
      }

      if (totalRuns >= maxTotalRuns) {
        return {
          allowed: false,
          reason: "BETA_GLOBAL_RUN_LIMIT_REACHED",
          testerRuns,
          totalRuns,
        };
      }

      const nextTesterRuns = testerRuns + 1;
      const nextTotalRuns = totalRuns + 1;

      runsByTester.set(testerId, nextTesterRuns);
      totalRuns = nextTotalRuns;

      return {
        allowed: true,
        reason: null,
        testerRuns: nextTesterRuns,
        totalRuns: nextTotalRuns,
      };
    },

    reset() {
      runsByTester.clear();
      totalRuns = 0;
    },
  };
}

const betaUsageStore = createBetaUsageStore();

export {
  createBetaUsageStore,
  betaUsageStore,
};
