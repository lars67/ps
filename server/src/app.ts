import { initWS } from "./services/websocket";
import { dbConnection } from "./db";
import { connect } from "mongoose";

let mongoose: typeof import("mongoose");
const startServer = async () => {
  console.log(process.cwd(), process.env.TEST, process.env.MONGODB_URI);
  mongoose = await connect(dbConnection.url);
  await initWS();
};

export const getMongoose = () => mongoose;
export default startServer;

//https://github.com/ahmadjoya/typescript-express-mongoose-starter/blob/main/tsconfig.json
