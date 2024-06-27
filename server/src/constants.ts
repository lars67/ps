export const errorMsgs  = {
    required: (err: string) => ({ error: `Not filled fields: ${err}` }),
    required1: (err: string) => ({ error: `Not filled field: ${err}` }),
    unique: (value: string, field:string='name') => ({ error: `Field '${field}' with value='${value}' already exists` }),
    notExists: (id:string) => ({error: `document with _id='${id}' is not exists`}),
    failed: (text:string) => ({error: `operation ${text} failed`}),
    notAllowed: (text:string) =>  ({error: `${text}  is not allowed`}),
    unknown: (field: string, value:string) => ({error: `unknonown value '${value}' for ${field}`}),
    error: (error:string)=> ({error}),
    denied: (text:string) => ({error:`Access to ${text} denied`}),

}

export const  formatYMD = 'YYYY-MM-DD';
