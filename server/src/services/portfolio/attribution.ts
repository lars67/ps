import { Trade, TradeTypes } from "../../types/trade";
import { Portfolio } from "../../types/portfolio";
import { UserData } from "../../services/websocket";
import { getPortfolioInstanceByIDorName } from "../../services/portfolio/helper";
import { toNum } from "../../utils";
import { getPortfolioTrades } from "../../utils/portfolio";
import { getRate, getDateSymbolPrice, checkPortfolioPricesCurrencies, checkPrices, checkPriceCurrency } from "../../services/app/priceCashe";
import moment from "moment";

type AttributionParams = {
  _id: string;
};

export async function attribution(
  { _id }: AttributionParams,
  sendResponse: (data?: object) => void,
  msgId: string,
  userModif: string,
  userData: UserData,
): Promise<object | undefined> {
  const {
    _id: realId,
    error,
    instance: portfolio,
  } = await getPortfolioInstanceByIDorName(_id, userData);

  if (error || !portfolio) {
    return (error as object) || { error: `Portfolio ${_id} not found` };
  }

  const allTradesResult = await getPortfolioTrades(realId, undefined, {
    state: { $in: [1] },
  });

  if ((allTradesResult as { error: string }).error) {
    return allTradesResult as object;
  }

  const trades = allTradesResult as Trade[];
  
  // Warm the price cache to ensure latest market and FX rates are available
  const { uniqueSymbols, uniqueCurrencies } = await checkPortfolioPricesCurrencies(trades, portfolio.currency);
  const now = moment().format("YYYY-MM-DD");
  await checkPrices(uniqueSymbols, now);
  for (const cur of uniqueCurrencies) {
    await checkPriceCurrency(cur, portfolio.currency, now);
  }

  let tradingAmount = 0;
  let passiveAmount = 0;
  let currencyAmount = 0;
  
  const holdings: Record<string, { volume: number, avgPrice: number, avgRate: number, totalFeesBase: number }> = {};

  // 1. Ledger Processing (Realized components + established cost basis)
  for (const trade of trades) {
    const symbol = trade.symbol;
    const rate = trade.rate || 1.0;
    const price = trade.price;
    const volume = trade.volume;
    const feeBase = trade.fee * rate;

    if (trade.tradeType === TradeTypes.Trade) {
      if (!holdings[symbol]) holdings[symbol] = { volume: 0, avgPrice: 0, avgRate: 0, totalFeesBase: 0 };
      const h = holdings[symbol];

      if (trade.side === "B") {
        const costLocalPrev = h.volume * h.avgPrice;
        const costBasePrev = h.volume * h.avgPrice * h.avgRate;
        
        h.volume += volume;
        h.avgPrice = (costLocalPrev + (price * volume)) / h.volume;
        h.avgRate = (costBasePrev + (price * volume * rate)) / (h.volume * h.avgPrice);
        h.totalFeesBase += feeBase;
      } else {
        const sellVol = Math.min(volume, h.volume);
        // PRICE Component: Price shift at consistent historical rate
        tradingAmount += (price - h.avgPrice) * sellVol * h.avgRate;
        // CURRENCY Component: Rate shift on principal
        currencyAmount += (price * (rate - h.avgRate)) * sellVol;
        
        h.volume -= sellVol;
        h.totalFeesBase += feeBase;
      }
    } else if (trade.tradeType === TradeTypes.Dividends) {
      passiveAmount += (trade.price + (trade.fee || 0)) * rate;
    }
  }

  // 2. Mark-to-market Processing (Unrealized components)
  const today = moment().format("YYYY-MM-DD");
  for (const symbol in holdings) {
    const h = holdings[symbol];
    if (h.volume > 0) {
      const currentPrice = getDateSymbolPrice(today, symbol) || h.avgPrice;
      const tradeRef = trades.find(tr => tr.symbol === symbol);
      const currentRate = getRate(tradeRef?.currency || portfolio.currency, portfolio.currency, today) || h.avgRate;
      
      tradingAmount += (currentPrice - h.avgPrice) * h.volume * h.avgRate;
      currencyAmount += (currentPrice * (currentRate - h.avgRate)) * h.volume;
      
      // Trading bucket accounts for the cost of trade entry/exit
      tradingAmount -= h.totalFeesBase;
    }
  }

  const totalReturn = tradingAmount + passiveAmount + currencyAmount;

  // EPSILON Clean-up: Zero out tiny floating point residuals for UI clarity
  const finalize = (n: number) => Math.abs(n) < 0.0001 ? 0 : toNum({ n });

  return {
    symbol: "ATTRIBUTION",
    baseCurrency: portfolio.currency,
    totalReturn: finalize(totalReturn),
    breakdown: {
      trading: {
        amount: finalize(tradingAmount),
        percent: totalReturn ? Math.round((tradingAmount / totalReturn) * 10000) / 100 : 0
      },
      passive: {
        amount: finalize(passiveAmount),
        percent: totalReturn ? Math.round((passiveAmount / totalReturn) * 10000) / 100 : 0
      },
      currency: {
        amount: finalize(currencyAmount),
        percent: totalReturn ? Math.round((currencyAmount / totalReturn) * 10000) / 100 : 0
      }
    }
  };
}
