import test from "node:test";
import assert from "node:assert/strict";

import explainReportWithAI from "../src/agent/explainReportWithAI.js";

test("AI explanation uses the provided client and returns output text", async () => {
  const fakeClient = {
    responses: {
      create: async () => {
        return {
          output_text:
            "This idea is worth testing based on the current report.",
        };
      },
    },
  };

  const report = {
    idea: "Birthday Invitation",
    score: 7.4,
    recommendation: "WORTH_TESTING",
    reason: "SCORE_AND_FLOORS_PASSED",
    evidenceCoverage: 100,
    incompleteAnalysis: false,

    criteria: {
      demand: {
        score: 8,
        confidence: "HIGH",
        status: "COMPLETE",
      },

      competition: {
        score: 6,
        confidence: "MEDIUM",
        status: "COMPLETE",
      },

      profitability: {
        score: 7,
        confidence: "MEDIUM",
        status: "COMPLETE",
      },

      effort: {
        score: 8,
        confidence: "MEDIUM",
        status: "COMPLETE",
      },

      scalability: {
        score: 8,
        confidence: "MEDIUM",
        status: "COMPLETE",
      },
    },
  };

  const explanation = await explainReportWithAI(report, fakeClient);

  assert.equal(
    explanation,
    "This idea is worth testing based on the current report.",
  );
});