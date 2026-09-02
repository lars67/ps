import { Model, Schema, model, models } from "mongoose";
import { YieldCurve } from "../types/currencyYield";

const YieldCurveSchema = new Schema<YieldCurve>({
  currency: { type: String, required: true },
  bid: { type: Number },
  ask: { type: Number },
  last: { type: Number },
  updateTime: { type: String },
});

export const YieldCurveModel: Model<YieldCurve> =
  (models && models.YieldCurve) || model("YieldCurve", YieldCurveSchema, "Yieldcurves");

// Deferred index creation, same pattern as models/contract.ts / models/portfolio.ts (avoids
// buffering timeouts in worker threads).
const ensureIndexes = async () => {
  try {
    if (YieldCurveModel.collection) {
      await YieldCurveModel.collection.createIndex({ currency: 1 }, { unique: true });
      console.log('✅ YieldCurve indexes ensured');
    }
  } catch (error) {
    console.warn('⚠️ Failed to create YieldCurve indexes:', error);
  }
};

YieldCurveModel.init().then(() => {
  ensureIndexes();
});
