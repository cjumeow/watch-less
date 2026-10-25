import { describe, expect, test } from "vitest";
import { parseReply } from "@yt-digest/shared";

describe("parseReply", () => {
  test("accepts a request put in the queue", () => {
    expect(parseReply({ ok: true })).toEqual({ parsed: true, value: { ok: true } });
  });

  test.each(["invalid-request", "queue-unwritable"])("accepts the error %s", (error) => {
    expect(parseReply({ ok: false, error })).toEqual({ parsed: true, value: { ok: false, error } });
  });

  test.each([
    ["an error the host does not send", { ok: false, error: "disk-full" }],
    ["a failure without its error", { ok: false }],
    ["ok that is not a boolean", { ok: "true" }],
    ["a success with an error", { ok: true, error: "invalid-request" }],
    ["a field it does not know", { ok: true, queued: 1 }],
    ["null", null],
  ])("refuses %s", (_case, input) => {
    expect(parseReply(input)).toMatchObject({ parsed: false });
  });
});
