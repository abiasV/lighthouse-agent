import test from "node:test";
import assert from "node:assert/strict";

import calculateScalabilityScore from "../src/utils/calculateScalabilityScore.js";

test("high scalability produces a high score", () => {
  const score = calculateScalabilityScore({
    ordersPerHourWithoutExtraHelp: 20,
    manualBottleneckLevel: "LOW",
  });

  assert.equal(score, 10);
});

test("moderate scalability produces a medium-high score", () => {
  const score = calculateScalabilityScore({
    ordersPerHourWithoutExtraHelp: 10,
    manualBottleneckLevel: "MEDIUM",
  });

  assert.equal(score, 7);
});

test("low scalability produces a low score", () => {
  const score = calculateScalabilityScore({
    ordersPerHourWithoutExtraHelp: 2,
    manualBottleneckLevel: "HIGH",
  });

  assert.equal(score, 2);
});

test("very low capacity stays low", () => {
  const score = calculateScalabilityScore({
    ordersPerHourWithoutExtraHelp: 1,
    manualBottleneckLevel: "HIGH",
  });

  assert.equal(score, 1);
});

test("scalability score never exceeds 10", () => {
  const score = calculateScalabilityScore({
    ordersPerHourWithoutExtraHelp: 100,
    manualBottleneckLevel: "LOW",
  });

  assert.equal(score, 10);
});