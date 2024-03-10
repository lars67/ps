import {ObjectId} from "mongodb";

export type Play = {
    symbol: string
    name: string
    value:number
}

export type PlayWithID = Play & {_id: string | ObjectId}
