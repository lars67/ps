import { initWS, UserData, UserWebSocket } from "./services/websocket";
import { dbConnection } from "./db";
import { connect } from "mongoose";
import cookieParser from "cookie-parser";
import * as fs from "fs";
import { initCountries } from "./services/app/countries";
//import {initWatchers} from "./services/app/portfoliosState";
import express from "express";
import * as url from "url";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";
import logger from "@/utils/logger";
import process from "process";

const cors = require("cors");
const https = require("https");

const app = express();
//app.use(cors());
app.use(
  cors({
    origin: "http://localhost:3000", //process.env.CORS_ORIGIN, // Allowed origin
    credentials: true, // Allow sending/receiving cookies
  }),
);

app.use(cookieParser());
app.use(express.static("public"));

let mongoose: typeof import("mongoose");

const loginPort = (process.env.LOGIN_PORT || 3001) as number;
const mainServerPort = (process.env.APP_PORT || 3002) as number;
const guestServerPort = (process.env.GUEST_PORT || 3004) as number;

const startServer = async () => {
  console.log(process.cwd(), process.env.MONGODB_URI);
  mongoose = await connect(dbConnection.url);
  const key = fs.readFileSync("Certificate/STAR.softcapital.com.key");
  const cert = fs.readFileSync("Certificate/STAR.softcapital.com.crt");
  const ca = fs.readFileSync("Certificate/STAR.softcapital.com.ca.pem");
  var options = {
    key: key,
    cert: cert,
    ca: ca,
  };
  await initCountries();
  const httpsServerLogin = https.createServer(options, app);
  const httpsServerApp = https.createServer(options, app);
  const httpsServerGuest = https.createServer(options, app);

  await initWS(httpsServerLogin, httpsServerApp, httpsServerGuest);
  console.log("DATA_PROXY", process.env.DATA_PROXY);
  httpsServerLogin.listen(loginPort, () => {
    console.log(`Login server running on port ${loginPort}`);
  });
  httpsServerApp.listen(mainServerPort, () => {
    console.log(`Main server running on port ${mainServerPort}`);
  });
  httpsServerGuest.listen(guestServerPort, () => {
    console.log(`Guest server running on port ${guestServerPort}`);
  });
  const httpsServer = https.createServer(options, app);
  httpsServer.listen(3333, () => {
    console.log(`HTTPS server running on port 3333`);
  });

  app.get("/set-cookie", (req, res) => {
    const token = url.parse(req.url, true).query.token;
    res.cookie("ps2token", token, {
      path:'/',
      secure: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "none",
      domain: "localhost",
    });

    res.send("Cookie set");
  });

  //initWatchers();
};

app.get("/check-cookie", (req, res) => {
  const token = req.cookies.ps2token;
  console.log("/check-cookie token", token);
  if (!token) {
    return res
      .status(403)
      .send({ error: '"Authentication error:token not found!' });
  }
  jwt.verify(
    token.toString(),
    process.env.SECRET_KEY as string,
    (err: VerifyErrors | null, decoded: any) => {
      if (err) {
        console.log("token bad", err);
        res.status(403).json({ error: "Authentication error: Invalid token" });
      }
      console.log("decoded", decoded);
      res.json({ ...decoded, token });
    },
  );
});

app.post("/clear-cookie", (req, res) => {
  res.clearCookie("ps2token", {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "none",
    domain:'localhost',
    expires: new Date(0)
  });
  res.json({ message: "Logged out successfully" });
});
export const getMongoose = () => mongoose;
export default startServer;
