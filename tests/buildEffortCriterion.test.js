import test from "node:test";
import assert from "node:assert/strict";

import buildEffortCriterion from "../src/tools/buildEffortCriterion.js";

test("buildEffortCriterion creates a strong complete criterion", () => {
  const result = buildEffortCriterion({
    minutesPerOrder: 5,
    humanDependency: "LOW",
  });

  assert.equal(result.score, 10);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");

  assert.equal(result.effortInputs.minutesPerOrder, 5);

  assert.equal(result.effortInputs.humanDependency, "LOW");

  assert.equal(result.evidence.length, 1);

  assert.equal(result.evidence[0].type, "EFFORT_INPUTS");
});

test("buildEffortCriterion creates a medium score", () => {
  const result = buildEffortCriterion({
    minutesPerOrder: 15,
    humanDependency: "MEDIUM",
  });

  assert.equal(result.score, 7);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");
});

test("buildEffortCriterion creates a low score for high effort", () => {
  const result = buildEffortCriterion({
    minutesPerOrder: 60,
    humanDependency: "HIGH",
  });

  assert.equal(result.score, 2);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");

  assert.equal(result.evidence[0].value.minutesPerOrder, 60);

  assert.equal(result.evidence[0].value.humanDependency, "HIGH");
});