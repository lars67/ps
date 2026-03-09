import SSEService from "../services/app/SSEService";

export type ErrorType = {
    error: string;
};

export type StringRecord = Record<string, string>;

export type SubscribeObj = { handler: (o: object) => void; registeredHandler: (o: object) => void; sseService: SSEService; tradeHandler?: (ev: any) => void };
export type SubscribeMsgs = Record<string, SubscribeObj>
