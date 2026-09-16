import researchCompetitionReal from "./researchCompetitionReal.js";

import buildCompetitionCriterion from "./buildCompetitionCriterion.js";

async function runRealCompetitionPipeline(query, options = {}) {
  const { researchClient = null, signalClient = null } = options;

  const researchResult = await researchCompetitionReal(query, researchClient);

  const criterion = await buildCompetitionCriterion(
    researchResult,
    signalClient,
  );

  return criterion;
}

export default runRealCompetitionPipeline;