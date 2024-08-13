import { User, UserWithID } from "../types/user";
import { UserModel } from "../models/user";
import { FilterQuery } from "mongoose";

export async function list(
  filter: FilterQuery<User> = {},
): Promise<User[] | null> {
  try {
    const users = await UserModel.find(filter?.filter).lean();
    return users;
  } catch (err) {
    console.log(err);
  }
  return [];
}

export async function add(User: User): Promise<User | null> {
  const newUser = new UserModel(User);
  const added = await newUser.save();
  return added;
}

export async function update(
  User: Partial<UserWithID>,
): Promise<User | null> {
  const { _id, ...other } = User;
  return await UserModel.findByIdAndUpdate(_id, other,{new: true});
}

export async function remove(_id: string): Promise<User | null> {
  return await UserModel.findByIdAndDelete(_id);
}
