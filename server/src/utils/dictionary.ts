export const tradeType = {
  1: "Regular Trade",
  2: "Block Trade",
  3: "EFP Trade",
  4: "Transfer Trade",
  5: "Late Trade",
  6: "T Trade",
  7: "WAP Trade",
  8: "Bunched Trade",
  9: "Late bunched Trade",
  10: "Prior Reference Price Trade",
  11: "OTC Trade",
  20: "Dividend",
  21: "Cash flow",
  22: "Portfolio correction",
  23: "Underlying correction",
  24: "Contract correction",
  25: "Stock loan",
  27: "Booked dividend",
};

const tradeTypeKeys = Object.keys(tradeType) as string[];
console.log("tradeTypeKeys", tradeTypeKeys, typeof tradeTypeKeys[0]);
export const isTradeType = (t: string) => {
  console.log("TTTT", t, tradeTypeKeys);
  return tradeTypeKeys.includes(t);
};

export const tradeState = {
  1: "Active trade",
  2: "Deleted trade",
  4: "Closed trade",
};
