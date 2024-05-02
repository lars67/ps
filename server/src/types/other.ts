import SSEService from "../services/app/SSEService";

export type ErrorType = {
    error: string;
};

export type StringRecord = Record<string, string>;

export type SubscribeObj = { handler: (o: object) => void; sseService: SSEService };
export type SubscribeMsgs = Record<string, SubscribeObj>
