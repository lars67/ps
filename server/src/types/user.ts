import {ObjectId} from "mongodb";
import {Currency} from "@/types/currency";

export type User = {
  _id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  password?: string | null;
  image?: string;
 };


export type UserWithID = User & { _id: string | ObjectId };
