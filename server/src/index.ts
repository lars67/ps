import * as dotenv from "dotenv";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0'
dotenv.config();
import app from "./app";

app();
//https://github.com/ahmadjoya/typescript-express-mongoose-starter/blob/main/tsconfig.json
