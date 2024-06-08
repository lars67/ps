import { initWS } from "./services/websocket";
import { dbConnection } from "./db";
import { connect } from "mongoose";
import * as fs from "fs";
import {initCountries} from "./services/app/countries";
//import {initWatchers} from "./services/app/portfoliosState";
const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.static('public'));

let mongoose: typeof import("mongoose");

const loginPort = (process.env.LOGIN_PORT || 3001) as number;
const mainServerPort = (process.env.APP_PORT || 3002) as number;
const guestServerPort= (process.env.GUEST_PORT || 3004) as number;


const startServer = async () => {
  console.log(process.cwd(), process.env.MONGODB_URI);
  mongoose = await connect(dbConnection.url);
  const key = fs.readFileSync("Certificate/STAR.softcapital.com.key");
  const cert = fs.readFileSync("Certificate/STAR.softcapital.com.crt");
  const ca = fs.readFileSync("Certificate/STAR.softcapital.com.ca.pem");
  var options = {
    key: key,
    cert: cert,
    ca: ca
  };
  await initCountries();
  const httpsServerLogin = https.createServer(options, app);
  const httpsServerApp = https.createServer(options, app);
  const httpsServerGuest = https.createServer(options, app);

  await initWS(httpsServerLogin, httpsServerApp, httpsServerGuest);
  console.log('DATA_PROXY',process.env.DATA_PROXY);
  httpsServerLogin.listen(loginPort, () => {
    console.log(`Login server running on port ${loginPort}`);

  });
  httpsServerApp.listen(mainServerPort, () => {
    console.log(`Main server running on port ${mainServerPort}`)
  })
  httpsServerGuest.listen(guestServerPort, () => {
    console.log(`Guest server running on port ${guestServerPort}`)
  })
  const httpsServer = https.createServer(options, app);
  httpsServer.listen(3333, () => {
    console.log(`HTTPS server running on port 3333`)
  })

  //initWatchers();
};

export const getMongoose = () => mongoose;
export default startServer;

//https://github.com/ahmadjoya/typescript-express-mongoose-starter/blob/main/tsconfig.json
