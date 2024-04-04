import moment from 'moment';
import {fetchHistory, loadCompany} from "../../utils/fetchData";

import {StringRecord} from "../../types/other";

import {Trade} from "../../types/trade";
import {extractUniqueFields, findMaxByField, findMinByField} from "../../utils";
import {formatYMD} from "../../constants";

const dateHistory:Record<string, Record<string, number>> = {};
const histories: StringRecord = {};
const SEARCH_DAY = 10;

async function delay(n: number) {
    return new Promise((res: Function) => {
        setTimeout(() => {
            res();
        }, n);
    });
}
export async function checkPrices(portfolioSymbols:string[], startDate0: Date | string) {
    let isSended = 0;
    const startDate =  typeof  startDate0 === 'string' ? startDate0 : (moment(startDate0 as Date)).format(formatYMD);
    // console.log('checkPrices startDate:', startDate0, '>',startDate);
    //console.log('cekPrices', portfolio, startDate0);
    await Promise.all(
        portfolioSymbols.map(async (symbol:string, ind: number) => {
            if (!histories[symbol] || histories[symbol] > startDate) {
                const history = await fetchHistory({
                    symbol,
                    from: startDate,
                });
                histories[symbol] = startDate;
                history.map((h) => {
                    const { date,  close } = h;
                    if (!dateHistory[date]) {
                        dateHistory[date] = { [symbol]:  close };
                    } else {
                        dateHistory[date][symbol] = close;
                    }
                });
                if (isSended++ > 10) {
                    await delay(200);
                }
            }
        })
    );
}

export function getDatePrices(date:string, find: boolean=false) {
    if (dateHistory[date]) {
        return dateHistory[date];
    }
    if (find) {
        let prevDate = moment(date, formatYMD);
        for (let i = 1; i < SEARCH_DAY; i++) {
            prevDate = prevDate.add(-1, 'days');
            if (dateHistory[prevDate.format(formatYMD)]) {
                return dateHistory[prevDate.format(formatYMD)];
            }
        }
    }
    return null;
}
export function getDateSymbolPrice(dateInput:string, symbol: string) {
    const date = dateInput.split('T').shift()  as string;
    if (dateHistory[date] && dateHistory[date][symbol]) {
        return dateHistory[date][symbol];
    }

    let prevDate = moment(date, formatYMD);
    for (let i = 1; i < SEARCH_DAY; i++) {
        prevDate = prevDate.add(-1, 'days');
        const d = prevDate.format(formatYMD);
        if (dateHistory[d] && dateHistory[d][symbol]) {
            return dateHistory[d][symbol];
        }
    }

    return null;
}

export async function checkPriceCurrency(
    currency: string,
    balanceCurrency: string,
    startDateInput: string
) {
    const startDate = startDateInput.split('T').shift() as string
    if (balanceCurrency !== currency) {
        let symbol: string='';
        let fx = `${currency}${balanceCurrency}`;
        let fx2 = `${balanceCurrency}${currency}`;
        if (histories[fx]) {
            if (histories[fx] <= startDate) {
                return;
            }
            symbol = fx;
        } else if (histories[fx2]) {
            if (histories[fx2] <= startDate) {
                return;
            }
            symbol = fx2;
        }
        if (!symbol) {
            const comp = await loadCompany(`${fx}:FX`);
            symbol = comp.symbol ? fx : fx2;
        }
        let history = await fetchHistory({
            symbol: `${symbol}:FX`,
            from: startDate
        });
        if (history  && history.length<1 ) {
            history = await fetchHistory({
                symbol: `${symbol}:FX`,
            });


        }
        histories[symbol] = history[0].date;
       // console.log('remember', symbol, history.length);
        history.map(h => {
            const { date, close } = h;
            if (dateHistory[date]) {
                dateHistory[date][symbol] = close;
            } else {
                dateHistory[date] = { [symbol]: close };
            }
        });
    }

}



export async function checkPortfolioPricesCurrencies(
    trades: Trade[],
    balanceCurrency: string
) {
    const uniqueSymbols = extractUniqueFields(trades,'symbol');
    const uniqueCurrencies = extractUniqueFields(trades,'currency');
    const startDate =  findMinByField<Trade>(trades, 'tradeTime').tradeTime.split('T')[0]
    const endDate =  findMaxByField<Trade>(trades, 'tradeTime').tradeTime.split('T')[0]
    console.log('startDate', startDate);
    await checkPrices(uniqueSymbols, startDate);
    for (const currency of uniqueCurrencies) {
        await checkPriceCurrency(currency,   balanceCurrency, startDate)
    }
    return {startDate, endDate, uniqueSymbols, uniqueCurrencies}
}

export const priceToBaseCurrency = (price: number, date: string, currency:string, balanceCurrency:string) => {
    if (currency === balanceCurrency) {
        return price;
    }
    if (dateHistory[date]) {
        const rate = dateHistory[date][`${currency}${balanceCurrency}`]
            ? dateHistory[date][`${currency}${balanceCurrency}`]
            : 1 / dateHistory[date][`${balanceCurrency}${currency}`];
        if (rate) {
            return rate * price;
        } else {
            console.log(
                '!!!!!!!!!!!!!!!!!!!!rate',
                rate,
                date,
                currency,
                balanceCurrency,
                price
            );
        }
    }
    return null;
};


export const getRate = (currency: string, balanceCurrency: string, date: string) => {
    if (currency === balanceCurrency) {
        return 1;
    }
    //date = date.split('T')[0];
    //console.log(date,dateHistory[date])
    const rate1 = getDateSymbolPrice(date, `${currency}${balanceCurrency}`)
    const rate2 = getDateSymbolPrice(date, `${balanceCurrency}${currency}`)
    const r = rate1 ? rate1 : rate2 ? 1/rate2 :  0
    //console.log(`RATES '${currency}${balanceCurrency}' '${date}'`, rate1, rate2, '=>', r)
    return Number(r.toFixed(4));
};

/*
export function findSymbolDatePrices(date, symbol) {
    if (dateHistory[date] && dateHistory[date][symbol]) {
        return dateHistory[date][symbol];
    }
    let prevDate = moment(date, formatYMD);
    for (let i = 1; i < SEARCH_DAY; i++) {
        prevDate = prevDate.add(-1, 'days');
        const dh = dateHistory[prevDate.format(formatYMD)];
        if (dh && dh[symbol]) {
            return dh[symbol];
        }
    }
    return null;
}
*/
