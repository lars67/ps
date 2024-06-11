export type WSMsg = {
    data: string;
    msgId?: string;
    total: string;
    index: number;
};

export type JsonObject = {
    [key: string]: any;
}
export type ErrorType = {
    error: string;
};
