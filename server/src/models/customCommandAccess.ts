import { CustomCommandAccess } from "../types/customCommandAccess";
import { Model, Schema, model, models } from "mongoose";

const CustomCommandAccessSchema = new Schema<CustomCommandAccess>({
  label: String,
  access: String
});

export const CustomCommandAccessModel: Model<CustomCommandAccess> =
  (models && models.CustomCommandAccess) || model("CustomCommandAccess",CustomCommandAccessSchema, "customCommandAccess");
