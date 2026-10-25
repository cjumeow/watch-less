import { describe, expect, test } from "vitest";
import { buttonResult } from "./button-result.js";

describe("buttonResult", () => {
  test("shows the check when the host put the request in the queue", () => {
    expect(buttonResult({ replied: { ok: true } })).toEqual({ ok: true });
  });

  test("says the host is not installed when Chrome finds no host", () => {
    expect(buttonResult({ failed: "Specified native messaging host not found." })).toEqual({
      ok: false,
      message: "yt-digest is not installed",
    });
  });

  test("says the host did not respond when no reply came within 5 seconds", () => {
    expect(buttonResult("timedOut")).toEqual({ ok: false, message: "yt-digest did not respond" });
  });

  test.each([
    ["the host refused the request", { replied: { ok: false, error: "invalid-request" } }],
    ["the host could not write the queue", { replied: { ok: false, error: "queue-unwritable" } }],
    ["the host replied with something it never sends", { replied: { ok: "yes" } }],
    ["the host exited without replying", { failed: "Native host has exited." }],
    [
      "the host is installed for another extension",
      { failed: "Access to the specified native messaging host is forbidden." },
    ],
  ])("says yt-digest failed when %s", (_case, outcome) => {
    expect(buttonResult(outcome)).toEqual({ ok: false, message: "yt-digest failed" });
  });
});
