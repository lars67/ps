console.log('Node.js version:', process.version);
import * as dotenv from "dotenv";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0'
dotenv.config();

// --- Start: Pre-create log file if enabled ---
import * as fs from "fs";
import * as path from "path";
if (process.env.LOG_OUTGOING_WS_MESSAGES && process.env.LOG_OUTGOING_WS_MESSAGES.toLowerCase() !== 'false') {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFilePath = path.join(logDir, 'outgoing_ws.log');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      console.log(`[WS Logger] Created logs directory: ${logDir}`);
    }
    if (!fs.existsSync(logFilePath)) {
      fs.writeFileSync(logFilePath, `[${new Date().toISOString()}] Log file initialized.\n`);
      console.log(`[WS Logger] Created outgoing_ws.log file at: ${logFilePath}`);
    } else {
       console.log(`[WS Logger] outgoing_ws.log file already exists at: ${logFilePath}`);
    }
  } catch (err) {
    console.error('[WS Logger] Error ensuring outgoing_ws.log file exists:', err);
  }
} else {
   console.log('[WS Logger] Outgoing WS message logging is disabled via environment variable.');
}
// --- End: Pre-create log file if enabled ---

import app from "./app";
import { startMemoryMonitoring } from "./monitoring";

startMemoryMonitoring();
app();
//https://github.com/ahmadjoya/typescript-express-mongoose-starter/blob/main/tsconfig.json
