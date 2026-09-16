import extractDemandSignals from "./extractDemandSignals.js";
import calculateDemandScore from "../utils/calculateDemandScore.js";

async function evaluateDemandFromResearch(demandSummary, client = null) {
  const signals = await extractDemandSignals(demandSummary, client);

  const score = calculateDemandScore(signals);

  return {
    signals,
    score,
  };
}

export default evaluateDemandFromResearch;