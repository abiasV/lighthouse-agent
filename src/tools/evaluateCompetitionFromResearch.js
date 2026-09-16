import extractCompetitionSignals from "./extractCompetitionSignals.js";

import calculateCompetitionScore from "../utils/calculateCompetitionScore.js";

async function evaluateCompetitionFromResearch(
  competitionSummary,
  client = null,
) {
  const signals = await extractCompetitionSignals(competitionSummary, client);

  const score = calculateCompetitionScore(signals);

  return {
    signals,
    score,
  };
}

export default evaluateCompetitionFromResearch;