// A stand-in for the native host, which Chromium starts as it would start the real one: it reads one message in
// Native Messaging's framing (a 32-bit length in native byte order, then JSON) and answers as the test said to.
//
// FAKE_HOST_DIR, set by the test for the browser and so inherited by the host, holds:
//   reply.json     what to answer, or the word "silent" to never answer (the extension's 5-second timeout)
//   requests.jsonl one line per message received, appended

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.FAKE_HOST_DIR;
if (dir === undefined) throw new Error("FAKE_HOST_DIR is not set");

const chunks = [];
process.stdin.on("data", (chunk) => {
  chunks.push(chunk);
  const input = Buffer.concat(chunks);
  if (input.length < 4) return;
  const length = input.readUInt32LE(0);
  if (input.length < 4 + length) return;
  process.stdin.pause();
  const message = input.subarray(4, 4 + length).toString("utf8");
  appendFileSync(join(dir, "requests.jsonl"), message + "\n");

  const reply = readFileSync(join(dir, "reply.json"), "utf8").trim();
  // Staying alive without answering, until the browser closes the pipe or the test ends.
  if (reply === "silent") return;
  const body = Buffer.from(reply, "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]), () => process.exit(0));
});
