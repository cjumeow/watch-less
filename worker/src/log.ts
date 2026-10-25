import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { inspect } from "node:util";

/** Appends to the worker's log, one line per event, with the details of an error on the lines after it. */
export type Log = (videoId: string, message: string, error?: unknown) => Promise<void>;

export function fileLog(logFile: string): Log {
  return async (videoId, message, error) => {
    const details = error === undefined ? "" : `\n${inspect(error, { depth: 5 })}`;
    await mkdir(dirname(logFile), { recursive: true });
    await appendFile(logFile, `${new Date().toISOString()} ${videoId} ${message}${details}\n`);
  };
}
