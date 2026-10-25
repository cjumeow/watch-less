import { readFields, type Parsed } from "./fields.js";

/** Why the native host did not put a request in the queue. */
export type ReplyError = "invalid-request" | "queue-unwritable";

/** What the native host answers a request with. */
export type Reply = { ok: true } | { ok: false; error: ReplyError };

const REPLY_ERRORS: readonly ReplyError[] = ["invalid-request", "queue-unwritable"];

function isReplyError(value: unknown): value is ReplyError {
  return (REPLY_ERRORS as readonly unknown[]).includes(value);
}

export function parseReply(input: unknown): Parsed<Reply> {
  const fields = readFields(input, ["ok", "error"]);
  if (!fields.parsed) return fields;
  const { ok, error } = fields.value;
  if (ok === true) {
    if (error !== undefined) return { parsed: false, reason: "a reply with ok true has no error" };
    return { parsed: true, value: { ok } };
  }
  if (ok === false) {
    if (!isReplyError(error)) return { parsed: false, reason: `error is not one of ${REPLY_ERRORS.join(", ")}` };
    return { parsed: true, value: { ok, error } };
  }
  return { parsed: false, reason: "ok is not a boolean" };
}
