export const errorMsgs  = {
    required: (err: string) => ({ error: `Not filled fields: ${err}` }),
    required1: (err: string) => ({ error: `Not filled field: ${err}` }),
}
