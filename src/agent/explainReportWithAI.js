import OpenAI from "openai";

async function explainReportWithAI(report, client = null) {
  const openAIClient = client ?? new OpenAI();

  const response = await openAIClient.responses.create({
    model: "gpt-5.6",

    store: false,

    instructions: `
You are the explanation layer for the Lighthouse evaluation system.

The final recommendation, score, reason, criterion scores,
criterion confidence levels, and evidence coverage have already
been determined by deterministic code.

You must not change, override, reinterpret, weaken, strengthen,
or contradict any of those values.

Your job is only to explain the existing result in clear,
concise natural English.

Rules:
- State the existing recommendation exactly as provided.
- Explain the existing reason in plain English.
- Summarize the criterion scores and confidence levels.
- Mention evidence coverage.
- Do not invent evidence.
- Do not infer new facts.
- Do not calculate new scores.
- Do not suggest a different recommendation.
- Do not add strategic advice or next steps unless they are
  explicitly present in the report.
`,

    input: JSON.stringify(report),
  });

  return response.output_text;
}

export default explainReportWithAI;