import evaluateCompetitionFromResearch from "./evaluateCompetitionFromResearch.js";

async function buildCompetitionCriterion(researchResult, client = null) {
  const evaluation = await evaluateCompetitionFromResearch(
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

export default buildCompetitionCriterion;