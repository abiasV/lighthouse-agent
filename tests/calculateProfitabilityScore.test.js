import test from "node:test";
import assert from "node:assert/strict";

import calculateProfitabilityScore from "../src/utils/calculateProfitabilityScore.js";

test("high margin and fast break-even produce a high profitability score", () => {
  const unitEconomics = {
    sellingPrice: 8,
    profitPerSale: 7,
    breakEvenSales: 8,
    profitablePerSale: true,
  };

  const score = calculateProfitabilityScore(unitEconomics);

  assert.equal(score, 9);
});

test("medium margin and moderate break-even produce a medium score", () => {
  const unitEconomics = {
    sellingPrice: 10,
    profitPerSale: 4,
    breakEvenSales: 20,
    profitablePerSale: true,
  };

  const score = calculateProfitabilityScore(unitEconomics);

  assert.equal(score, 6);
});

test("low margin and slow break-even produce a low score", () => {
  const unitEconomics = {
    sellingPrice: 10,
    profitPerSale: 1,
    breakEvenSales: 40,
    profitablePerSale: true,
  };

  const score = calculateProfitabilityScore(unitEconomics);

  assert.equal(score, 2);
});

test("unprofitable sale produces zero profitability score", () => {
  const unitEconomics = {
    sellingPrice: 5,
    profitPerSale: -1,
    breakEvenSales: null,
    profitablePerSale: false,
  };

  const score = calculateProfitabilityScore(unitEconomics);

  assert.equal(score, 0);
});