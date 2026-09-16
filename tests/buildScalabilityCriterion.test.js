import test from "node:test";
import assert from "node:assert/strict";

import buildScalabilityCriterion from "../src/tools/buildScalabilityCriterion.js";

test("buildScalabilityCriterion creates a strong complete criterion", () => {
  const result = buildScalabilityCriterion({
    ordersPerHourWithoutExtraHelp: 20,
    manualBottleneckLevel: "LOW",
  });

  assert.equal(result.score, 10);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");

  assert.equal(result.scalabilityInputs.ordersPerHourWithoutExtraHelp, 20);

  assert.equal(result.scalabilityInputs.manualBottleneckLevel, "LOW");

  assert.equal(result.evidence.length, 1);

  assert.equal(result.evidence[0].type, "SCALABILITY_INPUTS");
});

test("buildScalabilityCriterion creates a medium score", () => {
  const result = buildScalabilityCriterion({
    ordersPerHourWithoutExtraHelp: 10,
    manualBottleneckLevel: "MEDIUM",
  });

  assert.equal(result.score, 7);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");
});

test("buildScalabilityCriterion creates a low score for poor scalability", () => {
  const result = buildScalabilityCriterion({
    ordersPerHourWithoutExtraHelp: 2,
    manualBottleneckLevel: "HIGH",
  });

  assert.equal(result.score, 2);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");

  assert.equal(result.evidence[0].value.ordersPerHourWithoutExtraHelp, 2);

  assert.equal(result.evidence[0].value.manualBottleneckLevel, "HIGH");
});