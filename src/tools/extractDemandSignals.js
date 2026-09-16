import OpenAI from "openai";

async function extractDemandSignals(demandSummary, client = null) {
  const openAIClient = client ?? new OpenAI();

  const response = await openAIClient.responses.create({
    model: "gpt-5.6",

    store: false,

    instructions: `
You extract structured demand signals from market research.

Do not make a business recommendation.
Do not calculate a demand score.
Do not invent evidence.

Return only valid JSON with exactly these boolean fields:

{
  "strongSearchInterest": boolean,
  "commercialIntent": boolean,
  "marketplacePurchases": boolean,
  "recentSales": boolean,
  "positiveTrend": boolean,
  "negativeTrend": boolean
}

Rules:
- Use only the supplied research summary.
- If the evidence does not clearly support a signal, return false.
- positiveTrend and negativeTrend must not both be true.
`,

    input: demandSummary,
  });

  return JSON.parse(response.output_text);
}

export default extractDemandSignals;