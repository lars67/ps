import { Model, Schema, model, models } from "mongoose";
import { Trade } from "@/types/trade";

const TradeSchema = new Schema<Trade>({
  tradeId: { type: String },
  side: { type: String }, //B.S,P,W
  tradeType: { type: String },
  portfolioId: { type: String, required: true },
  accountId: { type: String },
  symbol: { type: String },
  name: { type: String },
  volume: { type: Number },
  price: { type: Number },
  currency: { type: String },
  fee: { type: Number },
  feeSymbol: { type: Number },
  rate: { type: Number },
  userId: { type: String, required: true },
  tradeTime: { type: String },
  exchangeTime: { type: String },
  updateTime: { type: String },
  oldTradeId: { type: String },
  tradeSource: { type: String },
  orderId: { type: String },
  comment: { type: String },
  state: { type: String },
});

export const TradeModel: Model<Trade> =
  (models && models.Trade) || model("Trade", TradeSchema, "trades");

TradeSchema.post("save", async function (doc) {
  console.log("%s has been saved!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", doc._id);
  /*  const Log = LogModel.create({
        userId: doc.user,
        createdAt: new Date(),
        action: 'saveInvoice',
        data: doc,
    });*/
});

TradeSchema.post("updateOne", async function (doc) {
  console.log("%s has been updated!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", doc._id);
});
TradeSchema.post("findOneAndUpdate", async function (doc) {
  console.log("%s has been updated!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", doc._id);
});
