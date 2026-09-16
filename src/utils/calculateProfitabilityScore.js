function calculateProfitabilityScore(unitEconomics) {
  const { sellingPrice, profitPerSale, breakEvenSales, profitablePerSale } =
    unitEconomics;

  if (!profitablePerSale || profitPerSale <= 0 || sellingPrice <= 0) {
    return 0;
  }

  const profitMargin = profitPerSale / sellingPrice;

  let marginScore = 0;

  if (profitMargin >= 0.75) {
    marginScore = 6;
  } else if (profitMargin >= 0.5) {
    marginScore = 5;
  } else if (profitMargin >= 0.3) {
    marginScore = 4;
  } else if (profitMargin >= 0.15) {
    marginScore = 2;
  } else {
    marginScore = 1;
  }

  let breakEvenScore = 0;

  if (breakEvenSales <= 5) {
    breakEvenScore = 4;
  } else if (breakEvenSales <= 10) {
    breakEvenScore = 3;
  } else if (breakEvenSales <= 25) {
    breakEvenScore = 2;
  } else if (breakEvenSales <= 50) {
    breakEvenScore = 1;
  }

  return Math.min(10, marginScore + breakEvenScore);
}

export default calculateProfitabilityScore;