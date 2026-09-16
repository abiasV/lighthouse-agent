import OpenAI from "openai";

function buildKeywordResearchInstructions() {
  return `
You are executing a product research task.

Generate purchase-intent keyword candidates for the product idea.

Requirements:
- Return exactly 10 keywords.
- Keywords must be relevant to the product idea.
- Prefer phrases that indicate someone may be interested in finding, comparing, learning about, or buying the product.
- Avoid unrelated topics.
- Do not invent search-volume statistics.
- Do not claim these keywords were verified with live search data.

Return JSON only in this exact shape:

{
  "keywords": [
    "keyword 1",
    "keyword 2"
  ]
}
`;
}

function buildProductCopyInstructions() {
  return `
You are creating initial product copy.

Create concise product copy for the product idea.

Return JSON only in this exact shape:

{
  "title": "Product title",
  "description": "Product description",
  "keyBenefits": [
    "Benefit 1",
    "Benefit 2",
    "Benefit 3"
  ]
}
`;
}

function parseJsonOutput(outputText) {
  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error("REAL_EXECUTOR_INVALID_JSON");
  }
}

async function executeTaskReal(
  task,
  idea,
  scenario = "GOOD_OUTPUT",
  client = null,
) {
  const openAIClient = client ?? new OpenAI();

  if (task.id === "task_1") {
    const response = await openAIClient.responses.create({
      model: "gpt-5.6",

      store: false,

      instructions: buildKeywordResearchInstructions(),

      input: `Product idea: ${idea}`,
    });

    const parsed = parseJsonOutput(response.output_text);

    if (!Array.isArray(parsed.keywords) || parsed.keywords.length !== 10) {
      throw new Error("REAL_EXECUTOR_INVALID_KEYWORD_OUTPUT");
    }

    return {
      type: "KEYWORD_RESEARCH",
      idea: String(idea).trim(),
      keywords: parsed.keywords,
    };
  }

  if (task.id === "task_2") {
    const response = await openAIClient.responses.create({
      model: "gpt-5.6",

      store: false,

      instructions: buildProductCopyInstructions(),

      input: `Product idea: ${idea}`,
    });

    const parsed = parseJsonOutput(response.output_text);

    if (
      !parsed.title ||
      !parsed.description ||
      !Array.isArray(parsed.keyBenefits)
    ) {
      throw new Error("REAL_EXECUTOR_INVALID_PRODUCT_COPY_OUTPUT");
    }

    return {
      type: "PRODUCT_COPY",
      idea: String(idea).trim(),
      title: parsed.title,
      description: parsed.description,
      keyBenefits: parsed.keyBenefits,
    };
  }

  throw new Error("REAL_EXECUTOR_TASK_NOT_SUPPORTED");
}

export default executeTaskReal;