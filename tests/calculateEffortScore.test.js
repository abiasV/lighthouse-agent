import test from "node:test";
import assert from "node:assert/strict";

import calculateEffortScore from "../src/utils/calculateEffortScore.js";

test("low effort produces a high score", () => {
  const score = calculateEffortScore({
    minutesPerOrder: 5,
    humanDependency: "LOW",
  });

  assert.equal(score, 10);
});

test("moderate effort produces a medium-high score", () => {
  const score = calculateEffortScore({
    minutesPerOrder: 15,
    humanDependency: "MEDIUM",
  });

  assert.equal(score, 7);
});

test("high effort produces a low score", () => {
  const score = calculateEffortScore({
    minutesPerOrder: 60,
    humanDependency: "HIGH",
  });

  assert.equal(score, 2);
});

test("very high time effort stays low", () => {
  const score = calculateEffortScore({
    minutesPerOrder: 120,
    humanDependency: "HIGH",
  });

  assert.equal(score, 1);
});

test("effort score never exceeds 10", () => {
  const score = calculateEffortScore({
    minutesPerOrder: 1,
    humanDependency: "LOW",
  });

  assert.equal(score, 10);
});