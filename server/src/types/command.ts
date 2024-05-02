import { ObjectId } from "mongodb";

export type Command = {
  _id?: string | null;
  label?: string | null;
  value: string | null;
  description?: string | null;
  ownerId?: string | null;
  commandType?: string;
  extended?: object[];
  createdAt?: Date;
  updatedAt?: Date;
};

//export type CommandWithID = Command & { _id: string | ObjectId };
