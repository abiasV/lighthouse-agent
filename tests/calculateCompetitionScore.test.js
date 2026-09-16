import test from "node:test";
import assert from "node:assert/strict";

import calculateCompetitionScore from "../src/utils/calculateCompetitionScore.js";

test("high competition produces a low score", () => {
  const signals = {
    highListingDensity: true,
    strongEstablishedCompetitors: true,
    highMarketplaceSaturation: true,
    difficultDifferentiation: true,
    clearDifferentiationOpportunity: false,
  };

  const score = calculateCompetitionScore(signals);

  assert.equal(score, 2);
});

test("low competition produces the maximum score", () => {
  const signals = {
    highListingDensity: false,
    strongEstablishedCompetitors: false,
    highMarketplaceSaturation: false,
    difficultDifferentiation: false,
    clearDifferentiationOpportunity: false,
  };

  const score = calculateCompetitionScore(signals);

  assert.equal(score, 10);
});

test("differentiation opportunity improves competition score", () => {
  const signals = {
    highListingDensity: true,
    strongEstablishedCompetitors: false,
    highMarketplaceSaturation: false,
    difficultDifferentiation: false,
    clearDifferentiationOpportunity: true,
  };

  const score = calculateCompetitionScore(signals);

  assert.equal(score, 9);
});

test("competition score never exceeds 10", () => {
  const signals = {
    highListingDensity: false,
    strongEstablishedCompetitors: false,
    highMarketplaceSaturation: false,
    difficultDifferentiation: false,
    clearDifferentiationOpportunity: true,
  };

  const score = calculateCompetitionScore(signals);

  assert.equal(score, 10);
});