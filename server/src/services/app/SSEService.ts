import { sendEvent } from "../../services/app/eventEmiter";
import testLogger from "../../utils/testLogger";
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

  constructor(
    endPoint: string,
    query: string,
    eventName: string,
    onData?: (data: any) => void,
    onOpen?: () => void,
  ) {
    this.stopped = true;
    this.url = `${process.env.DATA_PROXY}/${endPoint}?${query}`;
    this.onData = onData;
    this.onOpen = onOpen;
    this.eventName = eventName;
    console.log("request SSE", this.url);
    this.start();
  }

  private start(): void {
    this.source = new EventSource(this.url, {
      https: { rejectUnauthorized: false },
    });
    if (!this.source) {
      console.log("this.soutrce is null");
      return;
    }
    this.stopped = false;
    this.source.onopen = (event) => {
      console.log("open", this.url);
      if (this.onOpen) this.onOpen();
    };
    this.source.onmessage = (event) => {
      const data: object = JSON.parse(event.data);
      if (this.onData) this.onData(data);
      // @ts-ignore
      //console.log('SSE EVENT', this.eventName, data)
      const actualData = actualizeData(data);
      if (actualData.length > 0) {
        testLogger.log(JSON.stringify(actualData));
        sendEvent(this.eventName, data);
      }
    };
    this.source.onerror = (event) => {
      console.log("sse onerror", event, this.url);
    };
  }

  public stop(): void {
    if (!this.stopped && this.source) {
      this.source.close();
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
      if (Object.keys(actual).length >= 2) return actual as Partial<QuoteData>;
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
