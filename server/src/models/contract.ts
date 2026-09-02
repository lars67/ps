import { Contract, ContractType, DayCountConvention, ExecutionStyle, TheoModel } from "../types/contract";
import { Model, Schema, model, models } from "mongoose";

const ContractSchema = new Schema<Contract>({
  underlyingSymbolMic: { type: String, required: true, index: true },
  contractType: { type: String, required: true, enum: Object.values(ContractType) },
  strike: { type: Number },
  expirationDate: { type: String, required: true },
  baseContractId: { type: Schema.Types.ObjectId, ref: "Contract" },
  dividendRate: { type: Number },
  theoModel: { type: String, enum: Object.values(TheoModel) },
  symbol: { type: String, required: true, index: true },
  multiplier: { type: Number, default: 1 },
  market: { type: String },
  feedCode: { type: String },
  provider: { type: String },
  updateTime: { type: String },
  // Strike-level overrides of the Underlying -> Expiration -> Strike cascade - see
  // services/derivatives/resolveContractSettings.ts.
  executionStyle: { type: String, enum: Object.values(ExecutionStyle) },
  dayCountConvention: { type: String, enum: Object.values(DayCountConvention) },
  volatilityOffset: { type: Number },
  rateOffset: { type: Number },
});

export const ContractModel: Model<Contract> =
  (models && models.Contract) || model("Contract", ContractSchema, "contracts");

// Defer index creation to happen after connection is established (same pattern as
// models/portfolio.ts) to avoid buffering timeouts in worker threads.
const ensureIndexes = async () => {
  try {
    if (ContractModel.collection) {
      // Logical identity for options: same underlying+type+strike+expiry is one contract.
      // The old SQL schema never enforced this (see docs/derivatives/03-migration-notes.md,
      // open question 3) - enforcing it here is a deliberate improvement, not a straight port.
      await ContractModel.collection.createIndex(
        { underlyingSymbolMic: 1, contractType: 1, strike: 1, expirationDate: 1 },
        {
          unique: true,
          partialFilterExpression: {
            contractType: { $in: [ContractType.Call, ContractType.Put] },
          },
        },
      );
      // Same idea for futures/forwards, which have no strike.
      await ContractModel.collection.createIndex(
        { underlyingSymbolMic: 1, contractType: 1, expirationDate: 1 },
        {
          unique: true,
          partialFilterExpression: {
            contractType: { $in: [ContractType.Future, ContractType.Forward] },
          },
        },
      );
      await ContractModel.collection.createIndex({ symbol: 1 });
      console.log('✅ Contract indexes ensured');
    }
  } catch (error) {
    console.warn('⚠️ Failed to create contract indexes:', error);
  }
};

ContractModel.init().then(() => {
  ensureIndexes();
});
