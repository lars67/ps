import { Model, Schema, model, models } from "mongoose";
import { DayCountConvention, ExecutionStyle } from "../types/contract";
import { ContractExpiration } from "../types/contractExpiration";

const ContractExpirationSchema = new Schema<ContractExpiration>({
  underlyingSymbolMic: { type: String, required: true },
  expirationDate: { type: String, required: true },
  executionStyle: { type: String, enum: Object.values(ExecutionStyle) },
  dayCountConvention: { type: String, enum: Object.values(DayCountConvention) },
  volatilityOffset: { type: Number },
  rateOffset: { type: Number },
  multiplier: { type: Number },
  updateTime: { type: String },
});

export const ContractExpirationModel: Model<ContractExpiration> =
  (models && models.ContractExpiration) ||
  model("ContractExpiration", ContractExpirationSchema, "contractExpirations");

// Deferred index creation, same pattern as models/contract.ts / models/portfolio.ts.
const ensureIndexes = async () => {
  try {
    if (ContractExpirationModel.collection) {
      await ContractExpirationModel.collection.createIndex(
        { underlyingSymbolMic: 1, expirationDate: 1 },
        { unique: true },
      );
      console.log('✅ ContractExpiration indexes ensured');
    }
  } catch (error) {
    console.warn('⚠️ Failed to create contractExpiration indexes:', error);
  }
};

ContractExpirationModel.init().then(() => {
  ensureIndexes();
});
