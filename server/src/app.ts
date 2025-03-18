import { initWS, UserData, UserWebSocket } from "./services/websocket";
import { dbConnection } from "./db";
import { connect } from "mongoose";
import cookieParser from "cookie-parser";
import * as fs from "fs";
import {getAllCountries, initCountries} from "./services/app/countries";
//import {initWatchers} from "./services/app/portfoliosState";
import express from "express";
import * as url from "url";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";
import process from "process";
import {getDatePrices, getSymbolPrices} from "./services/app/priceCashe";
import * as path from "path";

const cors = require("cors");
const https = require("https");

const app = express();
//app.use(cors());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'ps2token']
  }),
);

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cookieParser(process.env.SECRET_KEY));
app.use(express.static("public"));


let mongoose: typeof import("mongoose");

const loginPort = (process.env.LOGIN_PORT || 3001) as number;
const mainServerPort = (process.env.APP_PORT || 3002) as number;
const guestServerPort = (process.env.GUEST_PORT || 3004) as number;

const startServer = async () => {
  console.log(process.cwd(), process.env.MONGODB_URI);
  mongoose = await connect(dbConnection.url);
  const key = fs.readFileSync(path.join(process.cwd(), "../CertFinPension/finpension.dk.key"));
  const cert = fs.readFileSync(path.join(process.cwd(), "../CertFinPension/finpension_dk.crt"));
  const ca = fs.readFileSync(path.join(process.cwd(), "../CertFinPension/My_CA_Bundle.ca-bundle"));
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

  //initWatchers();
};

app.get("/hi", async (req, res) => {
      res.json({a:777});
});

app.get("/set-cookie", (req, res) => {
  const token = url.parse(req.url, true).query.token;
  res.cookie("ps2token", token, {
    path:'/',
    secure: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "none",
    domain: process.env.DOMAIN,
  });

  res.send("Cookie set");
});

app.get("/cashtest", async (req, res) => {
  const {symbol,date, o} = req.query;
  console.log('/cashtest', symbol, date, o);
  switch (o) {
    case 'day':
      res.json(await getDatePrices(date as string));
    default :
      res.json(await getSymbolPrices(symbol as string));
  }
});

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

app.get("/countries", async (req, res) => {

  res.json(getAllCountries());
});


app.post("/clear-cookie", (req, res) => {
  res.clearCookie("ps2token", {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "none",
    domain: process.env.DOMAIN,
    expires: new Date(0)
  });
  res.json({ message: "Logged out successfully" });
});
export const getMongoose = () => mongoose;
export default startServer;
