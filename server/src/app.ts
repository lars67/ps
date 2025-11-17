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
import { dividendCronJob } from "./jobs/dividendCronJob";
import { portfolioHistoryCronJob } from "./jobs/portfolioHistoryCronJob";

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
  
  // Support both HTTP and HTTPS simultaneously
  const http = require('http');
  
  // Create HTTPS servers (for production)
  let httpsServerLogin, httpsServerApp, httpsServerGuest, httpsMainServer;
  
  try {
    console.log("Creating HTTPS servers for production mode");
    const certPath = path.join(process.cwd(), "../Certificate");
    console.log("Using certificates from:", certPath);
    
    const key = fs.readFileSync(path.join(certPath, "STAR.softcapital.com.key"));
    const cert = fs.readFileSync(path.join(certPath, "STAR.softcapital.com.crt"));
    const ca = fs.readFileSync(path.join(certPath, "STAR.softcapital.com.bundle.pem"));
    
    var options = {
      key: key,
      cert: cert,
      ca: ca,
    };
    
    httpsServerLogin = https.createServer(options, app);
    httpsServerApp = https.createServer(options, app);
    httpsServerGuest = https.createServer(options, app);
    httpsMainServer = https.createServer(options, app);
  } catch (error) {
    console.error("Error loading SSL certificates:", error);
    console.error("HTTPS servers will not be available");
  }
  
  // Create HTTP servers (for development)
  console.log("Creating HTTP servers for development mode");
  const httpServerLogin = http.createServer(app);
  const httpServerApp = http.createServer(app);
  const httpServerGuest = http.createServer(app);
  const httpMainServer = http.createServer(app);
  
  // Determine which servers to use as primary (HTTPS if available, otherwise HTTP)
  let serverLogin, serverApp, serverGuest, mainServer;
  let isDev = false;
  
  if (httpsServerLogin && httpsServerApp && httpsServerGuest && httpsMainServer) {
    // Use HTTPS servers as primary
    console.log("Using HTTPS servers as primary");
    serverLogin = httpsServerLogin;
    serverApp = httpsServerApp;
    serverGuest = httpsServerGuest;
    mainServer = httpsMainServer;
    isDev = false;
  } else {
    // Use HTTP servers as primary
    console.log("Using HTTP servers as primary (HTTPS not available)");
    serverLogin = httpServerLogin;
    serverApp = httpServerApp;
    serverGuest = httpServerGuest;
    mainServer = httpMainServer;
    isDev = true;
  }
  
  await initCountries();
  // Initialize WebSocket for primary servers
  await initWS(serverLogin, serverApp, serverGuest);

  // Initialize dividend cron job
  const cronSchedule = process.env.DIVIDEND_CRON_SCHEDULE || '0 4 * * *'; // Default: daily at 4 AM
  const cronEnabled = process.env.DIVIDEND_CRON_ENABLED !== 'false'; // Default: enabled

  if (cronEnabled) {
    try {
      dividendCronJob.start(cronSchedule);
      console.log(`Dividend cron job scheduled: ${cronSchedule}`);
    } catch (error) {
      console.error('Failed to start dividend cron job:', error);
    }
  } else {
    console.log('Dividend cron job disabled via environment variable');
  }

  // Initialize portfolio history cron job
  const portfolioHistoryCronEnabled = process.env.PORTFOLIO_HISTORY_CRON_ENABLED !== 'false'; // Default: enabled

  if (portfolioHistoryCronEnabled) {
    try {
      portfolioHistoryCronJob.start();
      console.log('Portfolio history cron job started (04:00 CET, Mon-Sat)');
    } catch (error) {
      console.error('Failed to start portfolio history cron job:', error);
    }
  } else {
    console.log('Portfolio history cron job disabled via environment variable');
  }

  console.log("DATA_PROXY", process.env.DATA_PROXY);
  
  // Start primary servers (HTTPS or HTTP)
  serverLogin.listen(loginPort, () => {
    console.log(`${isDev ? 'HTTP' : 'HTTPS'} Login server running on port ${loginPort}`);
  });
  
  serverApp.listen(mainServerPort, () => {
    console.log(`${isDev ? 'HTTP' : 'HTTPS'} Main server running on port ${mainServerPort}`);
  });
  
  serverGuest.listen(guestServerPort, () => {
    console.log(`${isDev ? 'HTTP' : 'HTTPS'} Guest server running on port ${guestServerPort}`);
  });
  
  mainServer.listen(3333, () => {
    console.log(`${isDev ? 'HTTP' : 'HTTPS'} Main server running on port 3333`);
  });
  
  if (isDev) {
    // Primary is HTTP, secondary is HTTPS (if available)
    if (httpsServerLogin && httpsServerApp && httpsServerGuest && httpsMainServer) {
      // Use different ports for HTTPS servers
      const httpsLoginPort = Number(loginPort) + 10000; // 13331
      const httpsAppPort = Number(mainServerPort) + 10000; // 13332
      const httpsGuestPort = Number(guestServerPort) + 10000; // 13334
      const httpsMainPort = 13333;
      
      // Initialize WebSocket for HTTPS servers
      await initWS(httpsServerLogin, httpsServerApp, httpsServerGuest);
      
      // httpsServerLogin.listen(httpsLoginPort, () => {
      //   // console.log(`HTTPS Login server running on port ${httpsLoginPort}`);
      // // });
      // //
      // // httpsServerApp.listen(httpsAppPort, () => {
      //   // console.log(`HTTPS Main server running on port ${httpsAppPort}`);
      // // });
      // //
      // // httpsServerGuest.listen(httpsGuestPort, () => {
      //   // console.log(`HTTPS Guest server running on port ${httpsGuestPort}`);
      // // });
      // //
      // // httpsMainServer.listen(httpsMainPort, () => {
      //   // console.log(`HTTPS Main server running on port ${httpsMainPort}`);
      // // });
      
      console.log("HTTPS servers are available on ports 13331, 13332, 13333, and 13334");
    } else {
      console.log("HTTPS servers are not available");
    }
  } else {
    // Primary is HTTPS, secondary is HTTP
    // Use different ports for HTTP servers
    const httpLoginPort = Number(loginPort) + 10000; // 13331
    const httpAppPort = Number(mainServerPort) + 10000; // 13332
    const httpGuestPort = Number(guestServerPort) + 10000; // 13334
    const httpMainPort = 13333;
    
    // Initialize WebSocket for HTTP servers
    await initWS(httpServerLogin, httpServerApp, httpServerGuest);
    
    // httpServerLogin.listen(httpLoginPort, () => {
    //   console.log(`HTTP Login server running on port ${httpLoginPort}`);
    // });
    //
    // httpServerApp.listen(httpAppPort, () => {
    //   console.log(`HTTP Main server running on port ${httpAppPort}`);
    // });
    //
    // httpServerGuest.listen(httpGuestPort, () => {
    //   console.log(`HTTP Guest server running on port ${httpGuestPort}`);
    // });
    //
    // httpMainServer.listen(httpMainPort, () => {
    //   console.log(`HTTP Main server running on port ${httpMainPort}`);
    // });
    
    // console.log("HTTP servers are available on ports 13331, 13332, 13333, and 13334");
  }
  // Start secondary servers (HTTP if primary is HTTPS, or vice versa)

  // Add graceful shutdown handling for cron jobs
  process.on('SIGINT', () => {
    console.log('Received SIGINT, stopping cron jobs...');
    dividendCronJob.stop();
    portfolioHistoryCronJob.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, stopping cron jobs...');
    dividendCronJob.stop();
    portfolioHistoryCronJob.stop();
    process.exit(0);
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

app.post("/run-dividend-job", async (req, res) => {
  console.log("Manual dividend job triggered via API");

  try {
    const stats = await dividendCronJob.runNow();
    console.log("Manual dividend job completed:", stats);

    res.json({
      success: true,
      message: "Dividend job completed manually",
      stats: stats
    });
  } catch (error) {
    console.error("Manual dividend job failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
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
