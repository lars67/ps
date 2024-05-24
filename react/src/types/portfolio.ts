


export type Portfolio = {
    _id?: string
    name: string;
    description:string;
    currency: string;
    userId: string;
    baseInstrument: string;

}

export type QuoteData = {
    [key: string]: any;
    key: string;
    symbol: string;
    currentDay: string;
    currency: string;
    price: number;
    rate: number;
    volume: number;
    invested: number;
    fee: number;
    realized: number;
    name: string;
    investedFull: number;
    investedFullSymbol: number;
    marketRate: number;
    marketValue: number;
    marketValueSymbol: number;
    avgPremium: number;
    avgPremiumSymbol: number;
    bprice: number;
    marketClose: number;
    marketPrice: number;
    feeSymbol: number;
    change: number;
    blink: boolean;
    a2: string;
    country:string;
    accountId: string;
};
