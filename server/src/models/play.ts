import {Play} from "../types/play";
import { Model, Schema, model, models } from 'mongoose';

const PlaySchema = new Schema<Play>({
    name: {type: String, default: 'Some name'},
    symbol: {type: String,default:'AAPL'},
    value: {type: Number}

});

export const PlayModel: Model<Play> =
    (models && models.Play) || model('Play', PlaySchema, 'plays');
