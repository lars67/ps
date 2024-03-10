import {Sector} from "../types/sector";
import { Model, Schema, model, models } from 'mongoose';

const SectorSchema = new Schema<Sector>({
    name: {type: String, default: 'Sector Name'},
    industry_sector_id: {type: String,default:'11223344'},
    symbol: {type: String, default: 'Symbol Name'},
});

export const SectorModel: Model<Sector> =
    (models && models.Sector) || model('Sector', SectorSchema, 'sectors');
