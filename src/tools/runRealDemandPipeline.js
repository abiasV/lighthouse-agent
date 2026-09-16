import researchDemandReal from "./researchDemandReal.js";

import buildDemandCriterion from "./buildDemandCriterion.js";

async function runRealDemandPipeline(idea, options = {}) {
  const { researchClient = null, signalClient = null } = options;

  const researchResult = await researchDemandReal(idea, researchClient);

  const criterion = await buildDemandCriterion(researchResult, signalClient);

  return criterion;
}

export default runRealDemandPipeline;