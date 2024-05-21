import { sendEvent } from "../../services/app/eventEmiter";
import testLogger from "../../utils/testLogger";
import {extractUniqueValues} from "../../utils";
const EventSource = require("eventsource");

export interface SSEServiceInst {
  stop: () => void;
}

export default class SSEService implements SSEServiceInst {
  private stopped: boolean;
  private url: string;
  private onData?: (data: any) => void;
  private onOpen?: () => void;
  private source: EventSource | null = null;
  private eventName: string;
  private endPoint
  private symbols: string='';
  private isFirst: boolean = true;

  constructor(
    endPoint: string,
    symbols: string,
    eventName: string,
    onData?: (data: any) => void,
    onOpen?: () => void,

  ) {
    this.endPoint = endPoint;
    this.stopped = true;
    this.url = `${process.env.DATA_PROXY}/${this.endPoint}?symbols=${symbols}`;
    this.onData = onData;
    this.onOpen = onOpen;
    this.eventName = eventName;
    this.start(symbols);
  }

  public start(symbols:string, restart:boolean=false): void {
    symbols = extractUniqueValues(symbols.split(',')).join(',');
    console.log('SYMBOLS', symbols);
    if (!restart && this.symbols === symbols) {
      return ;
    }
    this.isFirst= true;
    this.symbols = symbols;

    this.url = `${process.env.DATA_PROXY}/${this.endPoint}?symbols=${this.symbols}`;
    console.log("SSEServicce start---------->", this.url);
    this.source = new EventSource(this.url, {
      https: { rejectUnauthorized: false },
    });
    if (!this.source) {
      console.log("this.soutrce is null");
      return;
    }
    this.stopped = false;
    this.source.onopen = (event) => {
      console.log("SSEServicce open", this.url);
      if (this.onOpen) this.onOpen();
    };
    this.source.onmessage = (event) => {
      const data: object = JSON.parse(event.data);
      if (this.onData) this.onData(data);

      //console.log('isFirst', this.isFirst, 'ONMESSAGE SSE EVENT QUOTES FROM TOP')//, data)
      // @ts-ignore
      const actualData = this.isFirst  ?  data : actualizeData(data);
      //console.log('actualdata', actualData)
      this.isFirst= false;
      if (actualData) {
        testLogger.log(JSON.stringify(actualData));
        sendEvent(this.eventName, data);
      }

    };
    this.source.onerror = (event) => {
      console.log("SSEServicce onerror", event, this.url);
    };
  }

  public stop(): void {
    console.log('this.stopped', this.stopped)
    if (!this.stopped && this.source) {
      console.log("SSEServicce CLOSE", this.url);
      this.source.close();
      this.source = null;
      this.stopped = true;
    }
  }
  public getEventName(): string {
    return this.eventName;
  }
}

function actualizeData(ar: QuoteData[]) {
  return ar
    .map((d: QuoteData) => {
      /* symbol: string;
        currency: string;
        high: number;
        low: number;
        latestPrice: number;
        close: number;
        iexBidPrice: number;
        iexAskPrice: number;*/
      const {
        exchange,
        lastTradeTime,
        volume,
        change,
        changePercent,
        iexBidSize,
        iexAskSize,
        week52High,
        week52Low,
        companyName,
        country,
        ...actual
      } = d;
      const aa =  actual as Partial<QuoteData>;
     // console.log(Object.keys(aa).length)
      if (Object.keys(aa).length >= 2) return aa;
      return null;
    })
    .filter(Boolean);
}

export interface QuoteData {
  symbol: string;
  currency: string;
  exchange: string;
  high: number;
  low: number;
  latestPrice: number;
  lastTradeTime: string;
  volume: number;
  close: number;
  change: number;
  changePercent: number;
  iexBidPrice: number;
  iexBidSize: number;
  iexAskPrice: number;
  iexAskSize: number;
  week52High: number;
  week52Low: number;
  companyName: string;
  country: string;
}
