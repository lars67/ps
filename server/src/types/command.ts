import {ObjectId} from "mongodb";

export type Command = {
    id?: string | null;
    label?: string | null;
    value: string | null;
    description?: string | null;
    ownerId?: string | null;
    commandType?: string
}

export type CommandWithID = Command & {_id: string | ObjectId}

