import {Trade, TradeSide} from "../../types/trade";
import {ErrorType} from "../../types/other";
import {PortfolioModel} from "../../models/portfolio";
import {CurrencyModel} from "../../models/currency";
import {getRealId, isErrorType, isISODate} from "../../utils";
import {TradeModel} from "../../models/trade";
import {sendEvent} from "../../services/app/eventEmiter";
import {Portfolio} from "../../types/portfolio";
import {checkPriceCurrency, getDateSymbolPrice} from "../../services/app/priceCashe";
import moment from "moment";
import {formatYMD} from "../../constants";

export type PutCash = {
    portfolioId: string;
    amount: string;
    currency: string;
    userId?: string;
    tradeTime?: string;
    tradeType: string
    rate: number
};
export async function putSpecialTrade(
    par: PutCash,
    sendResponse: (data: any) => void,
    msgId: string,
    userModif: string,
    userId: string,
): Promise<Trade | ErrorType | undefined> {
    let err_required = ["currency", "amount", "portfolioId"].reduce(
        (err, fld) => {
            if (!par[fld as keyof PutCash]) {
                err += `${fld}, `;
            }
            return err;
        },
        "",
    );

    const realId = await getRealId<Portfolio>(par.portfolioId,PortfolioModel);
    if (  isErrorType(realId)){
        return realId;
    } else {
        par.portfolioId= realId
    }
    const portfolio = await PortfolioModel.findById(par.portfolioId)
    if (!portfolio) {
        return { error: `Unknown portfolio ` };
    }
    if (!(await CurrencyModel.find({ symbol: par.currency }))) {
        return { error: `Unknown currency` };
    }
    if (!par.userId) {
        par.userId = userId;
    }
    if (!par.tradeTime) {
        par.tradeTime = new Date().toISOString();
    } else if (!isISODate(par.tradeTime)) {
        return { error: `Wrong tradeTime format` };
    }
    if (!par.rate) {
        if (portfolio.currency === par.currency) {
            par.rate = 1;
        } else {
            const fx = `${par.currency}${portfolio.currency}`;
            let rate = getDateSymbolPrice(par.tradeTime, fx);
            console.log('fx, rate', fx, rate);
            if (!rate) {
                const leftDate =  moment(par.tradeTime.split('T').shift(), formatYMD);
                console.log('leftDate', leftDate.add(-7, 'days').format(formatYMD));

                await checkPriceCurrency(
                    par.currency,
                    portfolio.currency,
                    leftDate.add(-7, 'days').format(formatYMD));
                rate = getDateSymbolPrice(par.tradeTime, fx);
            }
            if (rate) {
                par.rate = rate;
            } else {
                throw `RATE unknown ${fx}`
            }
        }
    }
    console.log('par.rate=>', par.rate)
    const newTrade = new TradeModel({
        portfolioId: par.portfolioId,
        price: Number(par.amount),
        currency: par.currency,
        userId: par.userId,
        tradeTime: par.tradeTime,
        tradeType: par.tradeType,
        state: 1,
        side: TradeSide.PUT,
        volume: 0,
        fee: 0,
        contract: "CASH",
        rate:par.rate
    });

    const added = await newTrade.save();
    sendEvent("trade.add", added);
    return added;
}
