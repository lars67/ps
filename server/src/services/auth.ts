import { User } from "../types/user";
import { UserModel } from "../models/user";
import bcrypt from "bcryptjs";

export type SigninProps =
  | User
  | null
  | {
      error: string;
    };

export async function login(
  name: string,
  password: string,
): Promise<User | null> {
  try {
    const user = await UserModel.findOne({ name }).lean();
    console.log(`Use.findOne --------------> ${JSON.stringify(user)}`);

    if (!user) {
      throw new Error("Wrong credentials!");
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password || "",
    );
    //   console.log(`credentials.password : ${credentials.password}`)
    //  console.log(`user.password : ${user.password}`)

    if (!isPasswordCorrect) throw new Error("Wrong credentials!");

    console.log(`login: ${user}`);

    return user;
  } catch (err) {
    //  console.log(err);
  }
  return null;
}
