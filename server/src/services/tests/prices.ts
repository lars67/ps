
import {
    checkPortfolioPricesCurrencies,
    getDatePrices,
    getRate,
    priceToBaseCurrency
} from "../../services/app/priceCashe";
import moment from "moment/moment";
import {formatYMD} from "../../constants";
import {CommandDescription} from "../../types/custom";


const fakeTrades  = [
    {symbol: 'A', currency:'USD', tradeTime:'2022-02-21'},
    {symbol: 'MSFT', currency:'USD', tradeTime:'2022-02-21'},
    {symbol: 'DANSKE:XCSE', currency:'DKK', tradeTime:'2022-02-22'},
    {symbol: 'BN:XPAR', currency:'EUR', tradeTime:'2022-02-22'},
    {symbol: 'CTEC:XLON', currency:'GBP', tradeTime:'2022-02-25'},
    {symbol: 'A', currency:'USD', tradeTime:'2022-02-25'},
    {symbol: 'MSFT', currency:'USD', tradeTime:'2022-02-25'},

]
export async function prices(
    _id: string,
    sendResponse: (data: any) => void,
    msgId: string,
): Promise<{}> {
    let com = '';
    console.log('call RICES tests');

    // @ts-ignore
    const {startDate, uniqueSymbols, uniqueCurrencies} =await checkPortfolioPricesCurrencies(fakeTrades,'USD');
    console.log('P', startDate, uniqueSymbols, uniqueCurrencies)
    let date = moment(startDate);
    console.log('date', date)
    const prices = []
    for ( let i = 0 ; i <5;i++) {
        const d = date.clone().add(i,'d')
        const p = await getDatePrices(d.format(formatYMD)) || []
        prices.push({date:d.format(formatYMD), prices:p})
    }
    const r1 = getRate('GBP','USD', '2022-02-21');
    const r2 = getRate('DKK','USD', '2022-02-25');
    const r3 = getRate('USD','DKK', '2022-02-25');
    const getRateResult: object = {GBPUSD_20220221:r1 , DKKUSD_20220225: r2, USDDKK_20220225:r3, CHECK:r3*r2}


    const p1 = priceToBaseCurrency(100.0, '2022-02-21','GBP', 'USD' )
    const p2 = priceToBaseCurrency(100.0, '2022-02-25','DKK', 'USD' )
    const p3 = priceToBaseCurrency(100.0, '2022-02-25','USD', 'DKK' )
    const priceToBaseCurrencyResult={GBPUSD100:p1,DKKUSD100:p2, USDDKK100:p3,
        CHECK:[ r1*100-(p1 || 0), r2*100-(p2 ||0),r3*100-(p3 ||0)] }
    return { fakeTrades, startDate, uniqueSymbols, uniqueCurrencies, prices, getRateResult, priceToBaseCurrencyResult}
}

export const description: CommandDescription = {
    prices: {
        label: "Test priceCache",
        value: JSON.stringify({command: "tests.prices", output: '2'}),
    },
}
