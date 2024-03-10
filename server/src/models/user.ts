import {User} from "../types/user";
import { Model, Schema, model, models } from 'mongoose';

const UserSchema = new Schema<User>({
    name: String,
    email: String,
    role: String,
    image: String,
    password: String
});

export const UserModel: Model<User> =
    (models && models.User) || model('User', UserSchema, 'users');
