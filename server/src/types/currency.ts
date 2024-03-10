import {ObjectId} from "mongodb";

export type Currency = {
    currency_id: string
    symbol: string
    name: string
    bid_ir: string
    offer_ir: string
}

export type CurrencyWithID = Currency & {_id: string | ObjectId}
