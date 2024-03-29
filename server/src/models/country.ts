import { Country } from "../types/country";
import { Model, Schema, model, models } from "mongoose";

const CountrySchema = new Schema<Country>({
    countryId: String,
    a3: String,
    name: String,
    a2: String,
    tld: String,
    currency: String,
    callCode: String,
    region: String,
    subRegion: String
});

export const CountryModel: Model<Country> =
    (models && models.Country) ||
    model("Country", CountrySchema, "countries");
