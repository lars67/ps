import bcrypt from "bcryptjs";

import { User, UserWithID } from "../types/user";
import { UserModel } from "../models/user";
import { FilterQuery } from "mongoose";
import { ErrorType } from "../types/other";
import { errorMsgs } from "../constants";

// A password arriving here is always plaintext and is always hashed before it is stored - the
// same bcrypt work factor signup uses (services/auth.ts), so an account created or updated
// through these commands can log in exactly like one created through signup. Previously nothing
// on this path hashed anything: add() saved the object as given and update() went straight to
// findByIdAndUpdate, so a password set here was stored in clear and could never authenticate,
// because signin() compares with bcrypt.compare.
//
// An already-hashed value is not detected and re-hashed anyway: "password" means the real
// password, and sniffing for a bcrypt prefix would let a caller install a hash it did not know
// the plaintext for.
const SALT_ROUNDS = 10;

const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

// The stored value is a bcrypt hash, and nothing outside authentication has any use for it -
// so it is not handed back to callers. Hashes are still worth protecting: they are crackable
// offline given time.
const withoutPassword = <T extends { password?: string | null }>(user: T): Omit<T, "password"> => {
  const { password, ...rest } = user;
  return rest;
};

export async function list(
  filter: FilterQuery<User> = {},
): Promise<User[] | null> {
  try {
    const users = await UserModel.find(filter?.filter).lean();
    return users.map((u) => withoutPassword(u)) as unknown as User[];
  } catch (err) {
    console.log(err);
  }
  return [];
}

export async function add(User: User): Promise<User | ErrorType | null> {
  try {
    if (!User?.password) {
      return errorMsgs.error("password is required");
    }
    const newUser = new UserModel({ ...User, password: await hashPassword(User.password) });
    const added = await newUser.save();
    return withoutPassword(added.toObject()) as unknown as User;
  } catch (err) {
    console.log('[user.add] Error:', err);
    return null;
  }
}

export async function update(
  User: Partial<UserWithID>,
): Promise<User | ErrorType | null> {
  const { _id, ...other } = User;

  // The generated console template carries every field, password included and empty. Writing
  // that straight through would blank the stored hash and lock the account out, so an absent or
  // empty password means "leave it alone" - only a real new password is written.
  if (typeof other.password === "string" && other.password.length > 0) {
    other.password = await hashPassword(other.password);
  } else {
    delete other.password;
  }

  const updated = await UserModel.findByIdAndUpdate(_id, other, { new: true });
  return updated ? (withoutPassword(updated.toObject()) as unknown as User) : null;
}

export async function remove(_id: string): Promise<User | null> {
  const removed = await UserModel.findByIdAndDelete(_id);
  return removed ? (withoutPassword(removed.toObject()) as unknown as User) : null;
}
