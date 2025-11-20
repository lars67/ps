import { User } from "../types/user";
import { UserModel } from "../models/user";
import bcrypt from "bcryptjs";
import {ErrorType} from "../types/other";


export type SigninProps =
  | User
  | null
  | {
      error: string;
    };

export async function signin(
  login: string,
  password: string,
): Promise<User | null> {
  try {
    const user = await UserModel.findOne({ login }).lean();
    console.log(`Use.findOne --------------> ${JSON.stringify(user)}`);

    if (!user) {
      throw new Error("Wrong credentials!");
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password || "",
    );
      // console.log(`credentials.password : ${credentials.password}`)
      console.log(`isPasswordCorrect : $isPasswordCorrect} ${password}`)

    if (!isPasswordCorrect) throw new Error("Wrong credentials!");

    console.log(`login: ${user}`);

    return user;
  } catch (err) {
    //  console.log(err);
  }
  return null;
}

export async function signup(data: User): Promise<User | ErrorType> {
  let { login, email,password=''} = data;
  console.log(`[signup] Received data for user ${login}:`, { ...data, password: '[REDACTED]' });
  try {
    if (!password){ throw 'Password is empty'}
    const user = await UserModel.findOne({ login }).lean();
    if (user) {
      return {error:"User with login already exists"};
    }
    const salt = await bcrypt.genSalt(10);
    const epassword =  await bcrypt.hash(password, salt);
    const signupData = {...data, password: epassword, role:'member'};
    console.log(`[signup] Creating user with data:`, { ...signupData, password: '[REDACTED]' });
    const newDoc = new UserModel(signupData);
    const added = await newDoc.save();
    console.log(`[signup] User saved successfully:`, added._id);
    return added;
  } catch (err) {
     console.log('[signup] Error:', err);
  }
  return {error:'User account is not created'}
}
