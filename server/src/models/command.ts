import {Command} from "@/types/command";
import { Model, Schema, model, models } from 'mongoose';

const CommandSchema = new Schema<Command>({
    label: String,
    value: String,
    description: String,
    ownerId: String,
    commandType:String
});

export const CommandModel: Model<Command> =
    (models && models.Command) || model('Command', CommandSchema, 'commands');


