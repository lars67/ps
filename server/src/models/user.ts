import { User } from "../types/user";
import { Model, Schema, model, models } from "mongoose";

const UserSchema = new Schema<User>({
  login: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  image: String,
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  telephone: { type: String, required: true },
  country: { type: String, required: true },
  source: { type: String, required: false }
}, { strict: false });

// Force model recompilation
delete models.User;
export const UserModel: Model<User> = model("User", UserSchema, "users");

console.log('[UserModel] Model schema paths:', Object.keys(UserSchema.paths));
