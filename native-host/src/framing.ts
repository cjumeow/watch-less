// Native messaging framing: each message is the length of its JSON in bytes, a 32-bit unsigned integer in native byte
// order (little-endian on every Mac), followed by the JSON in UTF-8. Chrome frames the request this way on the host's
// stdin, and reads the reply framed the same way from its stdout.
import type { Parsed } from "@yt-digest/shared";

const HEADER_BYTES = 4;

// A request is an 11-character ID and a title of at most 500 characters, a few kilobytes even when every character
// is a long emoji sequence. Anything far larger is not a request, and is refused before it is read into memory.
const MAX_MESSAGE_BYTES = 64 * 1024;

/**
 * Reads one framed message from `input` and parses its JSON. It stops after the message's last byte and never waits
 * for the end of the input, since Chrome keeps the host's stdin open until the host exits.
 */
export async function readMessage(input: AsyncIterable<Uint8Array>): Promise<Parsed<unknown>> {
  let buffered: Uint8Array = new Uint8Array(0);
  let length: number | undefined;
  for await (const chunk of input) {
    buffered = concat(buffered, chunk);
    if (length === undefined && buffered.length >= HEADER_BYTES) {
      length = new DataView(buffered.buffer, buffered.byteOffset).getUint32(0, true);
      if (length > MAX_MESSAGE_BYTES) {
        return { parsed: false, reason: `the message is larger than ${String(MAX_MESSAGE_BYTES)} bytes` };
      }
    }
    if (length !== undefined && buffered.length >= HEADER_BYTES + length) {
      const body = buffered.subarray(HEADER_BYTES, HEADER_BYTES + length);
      return parseJson(body);
    }
  }
  return { parsed: false, reason: "the input ended before the message did" };
}

function parseJson(body: Uint8Array): Parsed<unknown> {
  try {
    // `fatal`, so bytes that are not UTF-8 are refused rather than read as replacement characters.
    return { parsed: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown };
  } catch {
    return { parsed: false, reason: "the message is not JSON" };
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a);
  joined.set(b, a.length);
  return joined;
}

/** Frames `value` as one message, the way Chrome reads the reply from the host's stdout. */
export function frameMessage(value: unknown): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(value));
  const framed = new Uint8Array(HEADER_BYTES + body.length);
  new DataView(framed.buffer).setUint32(0, body.length, true);
  framed.set(body, HEADER_BYTES);
  return framed;
}
