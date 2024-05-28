import {StringRecord} from "../types/other";
import moment from "moment";

export type  HistoricalDataInput =
    {
        date: string,
        open?: string,
        high?: string,
        low?: string,
        close:string,
        ['adj close']? : string,
        volume?: string
    }


export type  HistoricalData = {
    dateUnix?: Date,
    date: string,
    open?: number,
    high?: number,
    low?: number,
    close: number,
    volume?: number
}




const baseUrl = process.env.DATA_PROXY || 'https://top.softcapital.com/scproxy'

export const getDataUrl = (endPoint:string, query:string='') =>
    `${baseUrl}/${endPoint}?${query}`;

export const toQueryString = (query: StringRecord) =>
    Object.entries(query)
        .map(([key, val]) => `${key}=${encodeURI(val)}`)
        .join('&');

export const fetchHistory =  async function(query:StringRecord):Promise<HistoricalData[]> {
    try {

        console.log(getDataUrl('historical', toQueryString(query)));
        const response = await fetch(getDataUrl('historical', toQueryString(query)) );
        const data = await response.json();
        const symbol = query.symbol;
        let prevValue: HistoricalDataInput;
        const targetData = data.map((item:HistoricalDataInput) => {
            const preparedItem = {
                date: item.date,
                dateUnix: moment(item.date, 'YYYY-MM-DD').valueOf(), //unix(),utoDate(),
                open: parseFloat(item.open || ''),
                high: parseFloat(item.high|| ''),
                low: parseFloat(item.low || ''),
                close: parseFloat(
                    item.close ||
                    item['adj close'] ||
                    (prevValue && ( prevValue.close || prevValue['adj close'] )) || ''),
                volume: parseFloat(item.volume || '0')
            };
            if (item['adj close'] || item.close) {
                prevValue = item;
            }
            return preparedItem;
        });

        return targetData;
    } catch (err) {
        console.log('Error', query, err);
        return [];
    }
}

export async function fetchHistoryDate(symbol:string, date:string):Promise<HistoricalData | {}> {
    try {
        const rnd = Date.now();
        const response = await fetch(
            getDataUrl(`historical/${symbol}/${date}`, `rnd=${rnd}`)
        );
        const data = await response.json();
        return data;
    } catch (err) {
        console.log('Error', err);
        return {};
    }
}



export async function getDividends(symbol:string) {
    try {
        const response = await fetch(getDataUrl(`dividends`,toQueryString({symbol,range:'max'})));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error', err);
        return '';
    }
}

export async function loadCompany(symbol:string) {
    try {
        const response = await fetch(getDataUrl(`company`,toQueryString({symbol})));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error getCompany', err);
        return null;
    }
}

export async function loadInstruments(symbols:string) {
    try {
        const response = await fetch(getDataUrl(`instruments`,toQueryString({symbols})));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error getInstruments', err);
        return null;
    }
}

export async function loadCurrenciesList(symbols: StringRecord) {
    try {
        const response = await fetch(getDataUrl(`instruments/currencies`,toQueryString(symbols)));
        const data = await response.json();
        return  data
    } catch (err) {
        console.log('Error loadCurrenciesList', err);
        return [];
    }
}
