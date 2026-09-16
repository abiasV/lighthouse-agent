import test from "node:test";
import assert from "node:assert/strict";

import researchCompetitionReal from "../src/tools/researchCompetitionReal.js";

test("researchCompetitionReal returns structured competition research", async () => {
  const fakeClient = {
    responses: {
      create: async () => {
        return {
          output_text: `
Competition is substantial.
There are many established sellers and a large number of similar listings.
Differentiation is possible but difficult.
`,
          output: [
            {
              type: "web_search_call",
              action: {
                sources: [
                  {
                    type: "url",
                    url: "https://www.etsy.com/example",
                  },
                  {
                    type: "url",
                    url: "https://trends.google.com/example",
                  },
                  {
                    type: "url",
                    url: "https://www.paperlesspost.com/example",
                  },
                ],
              },
            },
          ],
        };
      },
    },
  };

  const result = await researchCompetitionReal(
    "Editable digital birthday invitation template",
    fakeClient,
  );

  assert.equal(typeof result.summary, "string");

  assert.equal(result.sources.length, 3);

  assert.equal(result.evidence.length, 1);

  assert.equal(result.evidence[0].type, "REAL_COMPETITION_RESEARCH");

  assert.equal(result.evidence[0].source, "OPENAI_WEB_SEARCH");

  assert.ok(result.evidence[0].quality.sourceQuality >= 0);

  assert.ok(result.evidence[0].quality.sourceQuality <= 100);

  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(result.confidence));
});