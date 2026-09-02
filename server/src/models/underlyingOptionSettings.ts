import { Model, Schema, model, models } from "mongoose";
import { DayCountConvention, ExecutionStyle } from "../types/contract";
import { UnderlyingOptionSettings } from "../types/underlyingOptionSettings";

const UnderlyingOptionSettingsSchema = new Schema<UnderlyingOptionSettings>({
  underlyingSymbolMic: { type: String, required: true },
  executionStyle: { type: String, enum: Object.values(ExecutionStyle) },
  dayCountConvention: { type: String, enum: Object.values(DayCountConvention) },
  multiplier: { type: Number },
  updateTime: { type: String },
});

export const UnderlyingOptionSettingsModel: Model<UnderlyingOptionSettings> =
  (models && models.UnderlyingOptionSettings) ||
  model("UnderlyingOptionSettings", UnderlyingOptionSettingsSchema, "underlyingOptionSettings");

// Deferred index creation, same pattern as models/contract.ts / models/portfolio.ts.
const ensureIndexes = async () => {
  try {
    if (UnderlyingOptionSettingsModel.collection) {
      await UnderlyingOptionSettingsModel.collection.createIndex({ underlyingSymbolMic: 1 }, { unique: true });
      console.log('✅ UnderlyingOptionSettings indexes ensured');
    }
  } catch (error) {
    console.warn('⚠️ Failed to create underlyingOptionSettings indexes:', error);
  }
};

UnderlyingOptionSettingsModel.init().then(() => {
  ensureIndexes();
});
