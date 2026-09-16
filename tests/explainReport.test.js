import test from "node:test";
import assert from "node:assert/strict";

import explainReport from "../src/agent/explainReport.js";

test("WORTH_TESTING explanation matches recommendation", () => {
  const report = {
    recommendation: "WORTH_TESTING",
    score: 7.4,
    evidenceCoverage: 100,

    criteria: {
      demand: {
        score: 8,
        confidence: "HIGH",
      },

      competition: {
        score: 6,
        confidence: "MEDIUM",
      },
    },
  };

  const explanation = explainReport(report);

  assert.match(explanation, /worth testing/i);

  assert.doesNotMatch(explanation, /reject/i);
});

test("NEEDS_MORE_RESEARCH explanation matches recommendation", () => {
  const report = {
    recommendation: "NEEDS_MORE_RESEARCH",
    score: 7.4,
    evidenceCoverage: 100,

    criteria: {
      demand: {
        score: 8,
        confidence: "HIGH",
      },

      competition: {
        score: 6,
        confidence: "LOW",
      },
    },
  };

  const explanation = explainReport(report);

  assert.match(explanation, /more research/i);

  assert.doesNotMatch(
    explanation,
    /worth testing based on the current evidence/i,
  );
});

test("REJECT explanation matches recommendation", () => {
  const report = {
    recommendation: "REJECT",
    score: 3.2,
    evidenceCoverage: 100,

    criteria: {
      demand: {
        score: 3,
        confidence: "HIGH",
      },

      competition: {
        score: 6,
        confidence: "MEDIUM",
      },
    },
  };

  const explanation = explainReport(report);

  assert.match(
    explanation,
    /does not currently meet the required decision rules/i,
  );

  assert.doesNotMatch(explanation, /worth testing/i);
});