export const errorMsgs  = {
    required: (err: string) => ({ error: `Not filled fields: ${err}` }),
    required1: (err: string) => ({ error: `Not filled field: ${err}` }),
    unique: (value: string, field:string='name') => ({ error: `Field '${field}' with value='${value}' already exists` }),
    notExists: (id:string) => ({error: `document with _id='${id}' is not exists`}),
}

export const  formatYMD = 'YYYY-MM-DD';
