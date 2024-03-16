import { CommandDescription } from "@/types/custom";

const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");

const logFolder = path.join(process.cwd(), "logs");
export function files() {
  return fs.readdirSync(logFolder);
}

async function readFile(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}
export async function file({ fileName }: { fileName: string }) {
  try {
    // Read the file asynchronously
    return (
      (await readFile(path.join(logFolder, fileName))) as Buffer
    ).toString("utf-8");
  } catch (err) {
    return { error: `Error reading file:${fileName}` };
  }
}

export const description: CommandDescription = {
  files: {
    label: "Logs",
    value: JSON.stringify({ command: "logs.files" }),
  },
  file: {
    label: "Log file",
    value: JSON.stringify({ command: "logs.file", fileName: "?" }),
  },
};

/*
export function watch(fileName:string) {
// Initialize chokidar to watch for changes in the directory
const watcher = chokidar.watch(logFolder);

// Add event listener for 'add' event
watcher.on('add', async (filePath) => {
    console.log(`File ${filePath} has been added`);

    // Read the contents of the file
    try {
        const data = await fs.promises.readFile(filePath, 'utf-8');

        // Process the data (e.g., copy new lines)
        // Here you can implement your logic to copy new lines to another file

        // For example, you could append new lines to another file
        const newPath = path.join('/path/to/destination/directory', path.basename(filePath));
        await fs.promises.appendFile(newPath, data);
        console.log(`New lines copied to ${newPath}`);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
    }
});
*/
