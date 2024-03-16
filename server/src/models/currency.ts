import { Currency } from "../types/currency";
import { Model, Schema, model, models } from "mongoose";

const CurrencySchema = new Schema<Currency>({
  currency_id: String,
  symbol: String,
  name: String,
  bid_ir: String,
  offer_ir: String,
});

export const CurrencyModel: Model<Currency> =
  (models && models.Currency) ||
  model("Currency", CurrencySchema, "currencies");
