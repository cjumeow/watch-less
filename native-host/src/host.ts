// What the native host does with one request: check it, write it to the queue, and answer.
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRequest, type QueueFile, type Reply } from "@yt-digest/shared";
import { frameMessage, readMessage } from "./framing.js";

export interface HostInput {
  /** The host's stdin, carrying one framed request. */
  input: AsyncIterable<Uint8Array>;
  /** The folder that holds the queue folder. */
  dataDir: string;
  now: () => Date;
}

/** Handles one request and returns the framed reply to write to stdout. */
export async function runHost({ input, dataDir, now }: HostInput): Promise<Uint8Array> {
  return frameMessage(await handle(input, dataDir, now));
}

async function handle(input: AsyncIterable<Uint8Array>, dataDir: string, now: () => Date): Promise<Reply> {
  const message = await readMessage(input).catch(() => ({ parsed: false }) as const);
  if (!message.parsed) return { ok: false, error: "invalid-request" };
  const request = parseRequest(message.value);
  if (!request.parsed) return { ok: false, error: "invalid-request" };
  // The request holds only what parseRequest accepts: the video, and the language and model when it has them.
  const queueFile: QueueFile = { ...request.value, requestedAt: now().toISOString() };
  return (await queue(dataDir, queueFile)) ? { ok: true } : { ok: false, error: "queue-unwritable" };
}

/** Writes `queueFile` to `<videoId>.json` in the queue folder, and says whether it could. */
async function queue(dataDir: string, queueFile: QueueFile): Promise<boolean> {
  const queueDir = join(dataDir, "queue");
  // Written in the data folder and renamed into the queue folder, so the worker never reads half a file and the queue
  // folder changes only when a whole request arrives. Both are in one folder tree, so the rename is atomic.
  const temporary = join(dataDir, `.${queueFile.videoId}.${randomUUID()}.tmp`);
  try {
    // Only the developer's account can read what they watch.
    await mkdir(queueDir, { recursive: true, mode: 0o700 });
    await writeFile(temporary, JSON.stringify(queueFile), { flag: "wx", mode: 0o600 });
    await rename(temporary, join(queueDir, `${queueFile.videoId}.json`));
    return true;
  } catch {
    await rm(temporary, { force: true }).catch(() => undefined);
    return false;
  }
}
