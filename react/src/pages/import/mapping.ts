import {TradesData} from "./TradesTable";

type FieldMapResult = { [key: string]: string | number };

type MapFields = Record<
  string,
  ((v: string | number) => TradesData) | string | number
>;

const toTradeTime = (dt: string) => {
  const ar = dt.split(";"); //20240509;231612
  return {
    tradeDate: `${ar[0].slice(0, 4)}-${ar[0].slice(4, 6)}-${ar[0].slice(6)}T${ar[1].slice(0, 2)}:${ar[1].slice(2, 4)}:${ar[1].slice(4)}`,
  };
};

const tradeMap: MapFields = {
  FXRateToBase: (v)      => ({rate:Math.abs(Number(v))}),
  //   AssetClass,
  Symbol: "symbol",
  // @ts-ignore
  'DateTime': toTradeTime,
  //    TradeDate,
  //    Exchange,
  Quantity: (v) => ({ volume: Math.abs(Number(v)) }),
  TradePrice:  v=> ({price:Number(v)}),
  //   FifoPnlRealized,
  "Buy/Sell": (v) => ({ side: (v as string).charAt(0) }),
  CurrencyPrimary: "currency",
  //   ListingExchange,
  IBCommission: (v)=> ({fee:Math.abs(Number(v))}),
  //   IBCommissionCurrency,
  //   ClosePrice,
  //  CostBasis
};
/*
FXRateToBase:, Symbol, Quantity,TradePrice,Buy/Sell,CurrencyPrimary,IBCommission
command
:
"trades.add"
currency
:
"USD"
fee
:
1.85362
msgId
:
155
portfolioId
:
"66775f022882e377c6b59454"
price
:
"1.08193"
rate
:
"0.92426"
side
:
"S"
state
:
1
symbol
:
"EUR.USD"
tradeDate
:
"2024-05-14T10:00:07"
tradeType
:
1
volume
:
61200
 */
//{"command":"trades.add","tradeId":"",

//?   "tradeType":"1",userId
//?  "portfolioId":"?",
// "accountId":"",
//"symbol":"","" +
//"name":"",
// "volume":++++++++++++++"",
// "price":"",+++++
// "currency":+++++++"?","fee":"","feeSymbol":"","rate":"","userId":"","tradeTime":"","exchangeTime":"","updateTime":"","oldTradeId":"","tradeSource":"","orderId":"","comment":"","state":"","closed":""}

function isFieldMapFunction(v: any): v is (input: string) => FieldMapResult {
  return (
    typeof v === "function" &&
    v.length === 1 &&
    typeof (v as (input: string) => FieldMapResult)("") === "object"
  );
}

export const mapToTrade = (data: FieldMapResult[]):TradesData[] => {

  const trades = data.map((d) =>
    Object.keys(tradeMap).reduce((o, fld) => {
      const fieldValue = d[fld];
      const fieldMapping = tradeMap[fld];
      if (typeof fieldMapping === 'function') {
        return { ...o, ...fieldMapping(fieldValue) };
      } else {
        return { ...o, [fieldMapping as keyof TradesData]: fieldValue };
      }
    }, {state:'1', tradeType: '1'} as TradesData),
  );
  return trades ;
};
