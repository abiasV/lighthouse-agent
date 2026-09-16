import test from "node:test";
import assert from "node:assert/strict";

import buildProfitabilityCriterion from "../src/tools/buildProfitabilityCriterion.js";

test("buildProfitabilityCriterion creates a strong complete criterion", () => {
  const result = buildProfitabilityCriterion({
    fixedCost: 50,
    sellingPrice: 8,
    variableCost: 1,
  });

  assert.equal(result.score, 9);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");

  assert.equal(result.unitEconomics.profitPerSale, 7);

  assert.equal(result.unitEconomics.breakEvenSales, 8);

  assert.equal(result.unitEconomics.profitablePerSale, true);

  assert.equal(result.evidence.length, 1);

  assert.equal(result.evidence[0].type, "UNIT_ECONOMICS");
});

test("buildProfitabilityCriterion creates a low score for weak economics", () => {
  const result = buildProfitabilityCriterion({
    fixedCost: 40,
    sellingPrice: 10,
    variableCost: 9,
  });

  assert.equal(result.score, 2);

  assert.equal(result.unitEconomics.profitPerSale, 1);

  assert.equal(result.unitEconomics.breakEvenSales, 40);

  assert.equal(result.unitEconomics.profitablePerSale, true);
});

test("buildProfitabilityCriterion returns zero when each sale loses money", () => {
  const result = buildProfitabilityCriterion({
    fixedCost: 50,
    sellingPrice: 4,
    variableCost: 6,
  });

  assert.equal(result.score, 0);
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.status, "COMPLETE");

  assert.equal(result.unitEconomics.profitPerSale, -2);

  assert.equal(result.unitEconomics.breakEvenSales, null);

  assert.equal(result.unitEconomics.profitablePerSale, false);
});