function calculateUnitEconomics({ fixedCost, sellingPrice, variableCost }) {
  const profitPerSale = sellingPrice - variableCost;

  if (profitPerSale <= 0) {
    return {
      fixedCost,
      sellingPrice,
      variableCost,
      profitPerSale,
      breakEvenSales: null,
      profitablePerSale: false,
    };
  }

  const breakEvenSales = Math.ceil(fixedCost / profitPerSale);

  return {
    fixedCost,
    sellingPrice,
    variableCost,
    profitPerSale,
    breakEvenSales,
    profitablePerSale: true,
  };
}

export default calculateUnitEconomics;