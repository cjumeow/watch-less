import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { readMessage } from "./framing.js";
import { runHost } from "./host.js";

// Made-up videos only: the repository is public.
const VIDEO_ID = "Ab3_dEf-9hZ";
const NOW = new Date("2026-03-04T05:06:07.890Z");

function frame(json: string): Uint8Array {
  const body = new TextEncoder().encode(json);
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, body.length, true);
  return new Uint8Array([...header, ...body]);
}

async function* chunks(...parts: Uint8Array[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) yield await Promise.resolve(part);
}

// The reply as Chrome reads it: one framed message.
async function reply(input: Uint8Array): Promise<unknown> {
  const read = await readMessage(chunks(await runHost({ input: chunks(input), dataDir, now: () => NOW })));
  if (!read.parsed) throw new Error(read.reason);
  return read.value;
}

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "yt-digest-host-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("runHost", () => {
  test("queues a request as <videoId>.json and replies ok", async () => {
    const answer = await reply(frame(JSON.stringify({ videoId: VIDEO_ID, title: "A made-up video" })));

    expect(answer).toEqual({ ok: true });
    expect(await readdir(join(dataDir, "queue"))).toEqual([`${VIDEO_ID}.json`]);
    const written = JSON.parse(await readFile(join(dataDir, "queue", `${VIDEO_ID}.json`), "utf8")) as unknown;
    expect(written).toEqual({ videoId: VIDEO_ID, title: "A made-up video", requestedAt: "2026-03-04T05:06:07.890Z" });
  });

  test("copies the request's language and model into the queue file", async () => {
    const request = { videoId: VIDEO_ID, title: "A made-up video", language: "zh-Hant", model: "claude-sonnet-5-5" };

    expect(await reply(frame(JSON.stringify(request)))).toEqual({ ok: true });

    const written = JSON.parse(await readFile(join(dataDir, "queue", `${VIDEO_ID}.json`), "utf8")) as unknown;
    expect(written).toEqual({ ...request, requestedAt: "2026-03-04T05:06:07.890Z" });
  });

  test("refuses a model the popup does not offer, and writes nothing", async () => {
    const request = { videoId: VIDEO_ID, title: "A made-up video", model: "--dangerously-skip-permissions" };

    expect(await reply(frame(JSON.stringify(request)))).toEqual({ ok: false, error: "invalid-request" });
    await expect(readdir(join(dataDir, "queue"))).rejects.toThrow();
  });

  test("replies queue-unwritable when the queue folder cannot be written", async () => {
    // A file where the queue folder should be, so the folder can be neither made nor written.
    await writeFile(join(dataDir, "queue"), "");

    const answer = await reply(frame(JSON.stringify({ videoId: VIDEO_ID, title: "A made-up video" })));

    expect(answer).toEqual({ ok: false, error: "queue-unwritable" });
  });

  test("refuses a video ID that could leave the queue folder, and writes nothing", async () => {
    const answer = await reply(frame(JSON.stringify({ videoId: "../../x.json", title: "A made-up video" })));

    expect(answer).toEqual({ ok: false, error: "invalid-request" });
    expect(await readdir(dataDir)).toEqual([]);
  });

  test("refuses a message that is not JSON, and writes nothing", async () => {
    const answer = await reply(frame("not json"));

    expect(answer).toEqual({ ok: false, error: "invalid-request" });
    expect(await readdir(dataDir)).toEqual([]);
  });

  test("replaces the queue file when a queued video is requested again", async () => {
    await reply(frame(JSON.stringify({ videoId: VIDEO_ID, title: "The first title" })));
    await reply(frame(JSON.stringify({ videoId: VIDEO_ID, title: "The second title" })));

    expect(await readdir(join(dataDir, "queue"))).toEqual([`${VIDEO_ID}.json`]);
    const written = JSON.parse(await readFile(join(dataDir, "queue", `${VIDEO_ID}.json`), "utf8")) as unknown;
    expect(written).toMatchObject({ title: "The second title" });
  });

  test("refuses a request whose input fails while it is read, and writes nothing", async () => {
    async function* failing(): AsyncGenerator<Uint8Array> {
      yield await Promise.resolve(new Uint8Array([10, 0]));
      throw new Error("stdin closed with an error");
    }
    const read = await readMessage(chunks(await runHost({ input: failing(), dataDir, now: () => NOW })));

    expect(read).toEqual({ parsed: true, value: { ok: false, error: "invalid-request" } });
    expect(await readdir(dataDir)).toEqual([]);
  });

  test("leaves nothing but the queue file behind", async () => {
    await reply(frame(JSON.stringify({ videoId: VIDEO_ID, title: "A made-up video" })));

    expect(await readdir(dataDir)).toEqual(["queue"]);
  });
});
