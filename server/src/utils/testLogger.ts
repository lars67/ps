import { format } from "date-fns";
import * as path from "path";
const fs = require("fs");

let logFileName: string | null = null;
let lastGeneratedDate: Date | null = null;

const logFolder = path.join(process.cwd(), "logs"); // Assuming 'logs' is the name of your log folder

// Ensure that the log folder exists, create it if it doesn't
if (!fs.existsSync(logFolder)) {
  fs.mkdirSync(logFolder);
}


function logToFile(message: string) {
  const fileName = 'testLog';
  const logFilePath = path.join(logFolder, fileName); // Assuming 'app.log' is the name of your log file

  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  logStream.write(`${message}\n`);
  logStream.end();
}

const logger = {
  log: (message: string) => logToFile(`${message}`),

};

export default logger;
