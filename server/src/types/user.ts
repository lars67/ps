import {ObjectId} from "mongodb";
import {Currency} from "@/types/currency";

export type User = {
  _id?: string | null;
  login?: string | null;
  email?: string | null;
  role?: string | null;
  password?: string | null;
  image?: string;
  firstName?: string,
  lastName?: string,
  accountNumber?: string,
  telephone?: string,
  country?: string
 };


export type UserWithID = User & { _id: string | ObjectId };
