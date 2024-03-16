import { Currency, CurrencyWithID } from "../types/currency";
import { CurrencyModel } from "../models/currency";
import { FilterQuery } from "mongoose";

export async function list(
  filter: FilterQuery<Currency> = {},
): Promise<Currency[] | null> {
  try {
    const currencies = await CurrencyModel.find(filter?.filter).lean();
    return currencies;
  } catch (err) {
    console.log(err);
  }
  return [];
}

export async function add(currency: Currency): Promise<Currency | null> {
  const newCurrency = new CurrencyModel(currency);
  const added = await newCurrency.save();
  return added;
}

export async function update(
  Currency: Partial<CurrencyWithID>,
): Promise<Currency | null> {
  const { _id, ...other } = Currency;
  return await CurrencyModel.findByIdAndUpdate(_id, other,{new: true});
}

export async function remove(_id: string): Promise<Currency | null> {
  return await CurrencyModel.findByIdAndDelete(_id);
}
