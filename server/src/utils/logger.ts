import { format } from "date-fns";
import * as path from "path";
import moment from "moment";
const fs = require("fs");

let logFileName: string | null = null;
let lastGeneratedDate: Date | null = null;

const logFolder = path.join(process.cwd(), "logs"); // Assuming 'logs' is the name of your log folder

// Ensure that the log folder exists, create it if it doesn't
if (!fs.existsSync(logFolder)) {
  fs.mkdirSync(logFolder);
}
console.log("logFolder", logFolder);
function generateLogFileName(): string {
  const currentDate = new Date();

  // If the log file name is not generated yet or if the last generated date is not today,
  // generate a new log file name with the current date.
  if (
    !logFileName ||
    !lastGeneratedDate ||
    lastGeneratedDate.getDate() !== currentDate.getDate()
  ) {
    lastGeneratedDate = currentDate;
    const formattedDate = format(currentDate, "yyyy-MM-dd");
    logFileName = `log_${formattedDate}.log`;
  }

  return logFileName;
}

function logToFile(message: string) {
  const t= moment().format('MM-DD HH:mm:ss SSS')
  const fileName = generateLogFileName();
  const logFilePath = path.join(logFolder, generateLogFileName()); // Assuming 'app.log' is the name of your log file

  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  logStream.write(`${t} ${message}\n`);
  logStream.end();
}

const logger = {
  log: (message: string) => logToFile(`${message}`),
  warn: (message: string) => logToFile(`[WARN] ${message}`),
  error: (message: string) => logToFile(`[ERROR] ${message}`),
};

export default logger;
