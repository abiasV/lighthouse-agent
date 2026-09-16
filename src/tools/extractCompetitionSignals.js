import OpenAI from "openai";

async function extractCompetitionSignals(competitionSummary, client = null) {
  const openAIClient = client ?? new OpenAI();

  const response = await openAIClient.responses.create({
    model: "gpt-5.6",

    store: false,

    instructions: `
You extract structured competition signals from market research.

Do not make a business recommendation.
Do not calculate a competition score.
Do not invent evidence.

Return only valid JSON with exactly these fields:

{
  "highListingDensity": boolean,
  "strongEstablishedCompetitors": boolean,
  "highMarketplaceSaturation": boolean,
  "difficultDifferentiation": boolean,
  "clearDifferentiationOpportunity": boolean
}

Rules:
- Use only the supplied research summary.
- If the evidence does not clearly support a signal, return false.
- difficultDifferentiation and clearDifferentiationOpportunity must not both be true.
`,

    input: competitionSummary,
  });

  return JSON.parse(response.output_text);
}

export default extractCompetitionSignals;