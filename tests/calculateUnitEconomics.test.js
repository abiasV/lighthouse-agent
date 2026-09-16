import test from "node:test";
import assert from "node:assert/strict";

import calculateUnitEconomics from "../src/utils/calculateUnitEconomics.js";

test("calculates profit per sale and break-even sales", () => {
  const result = calculateUnitEconomics({
    fixedCost: 50,
    sellingPrice: 8,
    variableCost: 1,
  });

  assert.equal(result.profitPerSale, 7);

  assert.equal(result.breakEvenSales, 8);

  assert.equal(result.profitablePerSale, true);
});

test("returns no break-even when profit per sale is zero", () => {
  const result = calculateUnitEconomics({
    fixedCost: 50,
    sellingPrice: 5,
    variableCost: 5,
  });

  assert.equal(result.profitPerSale, 0);

  assert.equal(result.breakEvenSales, null);

  assert.equal(result.profitablePerSale, false);
});

test("returns no break-even when each sale loses money", () => {
  const result = calculateUnitEconomics({
    fixedCost: 50,
    sellingPrice: 4,
    variableCost: 6,
  });

  assert.equal(result.profitPerSale, -2);

  assert.equal(result.breakEvenSales, null);

  assert.equal(result.profitablePerSale, false);
});