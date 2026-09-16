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

async function researchDemandReal(idea, client = null) {
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
You are gathering market-demand evidence for a product idea.

Do not make a final business recommendation.
Do not decide whether the idea should be accepted or rejected.
Do not provide a final demand score.

Search the web for current evidence related to demand for the idea.

Focus only on:
- current market interest
- trend direction
- buyer-intent signals
- recent relevant demand signals

Return a concise factual summary.

Do not invent statistics.
Clearly distinguish demand signals from competition or supply signals.
`,

    input: `Product idea:${idea}`,
  });

  const sources = extractSources(response);

  const evidenceItem = {
    type: "REAL_DEMAND_RESEARCH",
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

export default researchDemandReal;