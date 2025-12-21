import { Trade, TradeTypes } from "../../types/trade";
import { Portfolio } from "../../types/portfolio";
import { UserData } from "../../services/websocket";
import { getPortfolioInstanceByIDorName } from "../../services/portfolio/helper";
import { toNum } from "../../utils";
import { getPortfolioTrades } from "../../utils/portfolio";
import { getRate, getDateSymbolPrice } from "../../services/app/priceCashe";
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
  
  let tradingAmount = 0;
  let passiveAmount = 0;
  let currencyAmount = 0;
  
  const holdings: Record<string, { volume: number, avgRate: number, avgPrice: number }> = {};

  for (const trade of trades) {
    const symbol = trade.symbol;
    const rate = trade.rate || 1.0;
    const price = trade.price;
    const volume = trade.volume;
    const feeBase = trade.fee * rate;

    if (trade.tradeType === TradeTypes.Trade) { // Asset Trade
      const isBuy = trade.side === "B";
      if (!holdings[symbol]) holdings[symbol] = { volume: 0, avgRate: 0, avgPrice: 0 };
      const h = holdings[symbol];

      if (isBuy) {
        h.avgRate = (h.avgRate * h.volume + rate * volume) / (h.volume + volume);
        h.avgPrice = (h.avgPrice * h.volume + price * volume) / (h.volume + volume);
        h.volume += volume;
        tradingAmount -= feeBase;
      } else {
        const sellVolume = Math.min(volume, h.volume);
        tradingAmount += (price - h.avgPrice) * sellVolume * h.avgRate;
        currencyAmount += (price * (rate - h.avgRate)) * sellVolume;
        h.volume -= sellVolume;
        tradingAmount -= feeBase;
      }
    } else if (trade.tradeType === TradeTypes.Dividends) { // Dividend
      passiveAmount += (trade.price + (trade.fee || 0)) * rate;
    }
  }

  const now = moment().format("YYYY-MM-DD");
  for (const symbol in holdings) {
    const h = holdings[symbol];
    if (h.volume > 0) {
      const currentPrice = getDateSymbolPrice(now, symbol) || h.avgPrice;
      const t = trades.find(t=>t.symbol===symbol);
      const currentRate = getRate(t?.currency || portfolio.currency, portfolio.currency, now) || 1.0;
      
      tradingAmount += (currentPrice - h.avgPrice) * h.volume * h.avgRate;
      currencyAmount += (currentPrice * (currentRate - h.avgRate)) * h.volume;
    }
  }

  // FORCE 0% Currency Attribution for single-currency portfolios
  const uniqueCurrencies = [...new Set(trades.filter(t=>t.tradeType === TradeTypes.Trade).map(t=>t.currency))];
  if (uniqueCurrencies.length <= 1 && (uniqueCurrencies[0] === portfolio.currency || uniqueCurrencies.length === 0)) {
    currencyAmount = 0;
  }

  const totalReturn = tradingAmount + passiveAmount + currencyAmount;

  return {
    symbol: "ATTRIBUTION",
    baseCurrency: portfolio.currency,
    totalReturn: toNum({ n: totalReturn }),
    breakdown: {
      trading: { 
        amount: toNum({ n: tradingAmount }), 
        percent: totalReturn ? Math.round((tradingAmount / totalReturn) * 10000) / 100 : 0 
      },
      passive: { 
        amount: toNum({ n: passiveAmount }), 
        percent: totalReturn ? Math.round((passiveAmount / totalReturn) * 10000) / 100 : 0 
      },
      currency: { 
        amount: Math.abs(currencyAmount) < 0.01 ? 0 : toNum({ n: currencyAmount }), 
        percent: totalReturn ? Math.round((currencyAmount / totalReturn) * 10000) / 100 : 0 
      }
    }
  };
}
