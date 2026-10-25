import { describe, expect, test } from "vitest";
import { readMessage } from "./framing.js";

// A frame as Chrome writes it: the length of the JSON in bytes, as a 32-bit unsigned integer in little-endian order
// (this Mac's native order), then the JSON in UTF-8.
function frame(json: string): Uint8Array {
  const body = new TextEncoder().encode(json);
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, body.length, true);
  return new Uint8Array([...header, ...body]);
}

async function* chunks(...parts: Uint8Array[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) yield await Promise.resolve(part);
}

describe("readMessage", () => {
  test("reads the JSON of one framed message", async () => {
    const result = await readMessage(chunks(frame('{"videoId":"abcdefghijk","title":"Ünïcode 標題"}')));
    expect(result).toEqual({ parsed: true, value: { videoId: "abcdefghijk", title: "Ünïcode 標題" } });
  });

  test("refuses a message whose input ends before the length its header gives", async () => {
    const whole = frame('{"videoId":"abcdefghijk","title":""}');
    const result = await readMessage(chunks(whole.subarray(0, 10)));
    expect(result).toEqual({ parsed: false, reason: "the input ended before the message did" });
  });

  test("refuses a message whose header gives fewer bytes than its JSON has", async () => {
    const whole = frame('{"videoId":"abcdefghijk","title":""}');
    new DataView(whole.buffer).setUint32(0, 12, true);
    const result = await readMessage(chunks(whole));
    expect(result).toEqual({ parsed: false, reason: "the message is not JSON" });
  });

  test("refuses a message larger than 64 KiB from its header, without waiting for its bytes", async () => {
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 64 * 1024 + 1, true);
    const result = await readMessage(chunks(header));
    expect(result).toEqual({ parsed: false, reason: "the message is larger than 65536 bytes" });
  });
});
