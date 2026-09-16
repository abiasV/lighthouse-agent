import evaluateDemandFromResearch from "./evaluateDemandFromResearch.js";

async function buildDemandCriterion(researchResult, client = null) {
  const evaluation = await evaluateDemandFromResearch(
    researchResult.summary,
    client,
  );

  return {
    score: evaluation.score,
    confidence: researchResult.confidence,
    status: "COMPLETE",
    evidence: researchResult.evidence,
    signals: evaluation.signals,
  };
}

export default buildDemandCriterion;