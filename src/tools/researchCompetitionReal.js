import OpenAI from "openai";

import evaluateEvidenceQuality from "../utils/evaluateEvidenceQuality.js";

import qualityToConfidence from "../utils/qualityToConfidence.js";

function extractSources(response) {
  const sources = [];

  for (const item of response.output ?? []) {
    if (item.type === "web_search_call" && item.action?.sources) {
      for (const source of item.action.sources) {
        if (source.type === "url" && source.url) {
          sources.push(source.url);
        }
      }
    }
  }

  return [...new Set(sources)];
}

async function researchCompetitionReal(query, client = null) {
  const openAIClient = client ?? new OpenAI();

  const response = await openAIClient.responses.create({
    model: "gpt-5.6",

    store: false,

    tools: [
      {
        type: "web_search_preview",
      },
    ],

    include: ["web_search_call.action.sources"],

    instructions: `
You are gathering competition evidence for a product idea.

Do not make a final business recommendation.
Do not calculate a competition score.

Search the web for current competition evidence.

Focus only on:
- number of competing products or listings
- strength of established competitors
- marketplace saturation
- product differentiation difficulty
- signs of low or high competitive pressure

Do not treat buyer demand as competition evidence.

Return a concise factual summary.
Do not invent statistics.
`,

    input: `
Product idea or competition query:
${query}
`,
  });

  const sources = extractSources(response);

  const evidenceItem = {
    type: "REAL_COMPETITION_RESEARCH",
    source: "OPENAI_WEB_SEARCH",
    value: response.output_text,
    sources,
  };

  evidenceItem.quality = evaluateEvidenceQuality(evidenceItem);

  const confidence = qualityToConfidence(evidenceItem.quality);

  return {
    summary: response.output_text,
    sources,
    evidence: [evidenceItem],
    confidence,
  };
}

export default researchCompetitionReal;