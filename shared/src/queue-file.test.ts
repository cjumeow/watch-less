import { describe, expect, test } from "vitest";
import { parseQueueFile } from "@yt-digest/shared";

const queueFile = { videoId: "aB3_x-9Zq0Y", title: "A made-up video", requestedAt: "2026-10-25T08:00:00.000Z" };

describe("parseQueueFile", () => {
  test("accepts a video ID, a title and when it was requested", () => {
    expect(parseQueueFile(queueFile)).toEqual({ parsed: true, value: queueFile });
  });

  test("accepts a language and a model it knows", () => {
    const withSettings = { ...queueFile, language: "ja", model: "claude-opus-5-5" };
    expect(parseQueueFile(withSettings)).toEqual({ parsed: true, value: withSettings });
  });

  test.each([
    ["language", "fr"],
    ["model", "claude-made-up"],
    ["model", "--model"],
  ])("refuses a %s it does not know: %s", (name, value) => {
    expect(parseQueueFile({ ...queueFile, [name]: value })).toEqual({
      parsed: false,
      reason: expect.stringContaining(name) as string,
    });
  });

  test.each([
    ["10 characters", "aB3_x-9Zq0"],
    ["12 characters", "aB3_x-9Zq0YY"],
    ["a slash", "aB3_x/9Zq0Y"],
    ["a dot", "aB3_x.9Zq0Y"],
  ])("refuses a video ID of %s", (_case, videoId) => {
    expect(parseQueueFile({ ...queueFile, videoId })).toEqual({
      parsed: false,
      reason: expect.stringContaining("videoId") as string,
    });
  });

  test.each([["501 characters long", "x".repeat(501)]])("refuses a title that is %s", (_case, title) => {
    expect(parseQueueFile({ ...queueFile, title })).toEqual({
      parsed: false,
      reason: expect.stringContaining("title") as string,
    });
  });

  test.each([
    ["a date without a time", "2026-10-25"],
    ["a local time without its zone", "2026-10-25T08:00:00.000"],
    ["a time in another zone", "2026-10-25T16:00:00.000+08:00"],
    ["a date that does not exist", "2026-02-30T08:00:00.000Z"],
    ["a number of milliseconds", 1793001600000],
  ])("refuses requestedAt that is %s", (_case, requestedAt) => {
    expect(parseQueueFile({ ...queueFile, requestedAt })).toEqual({
      parsed: false,
      reason: expect.stringContaining("requestedAt") as string,
    });
  });

  test.each(["title", "requestedAt"])("refuses a queue file without %s", (name) => {
    const withoutIt = Object.fromEntries(Object.entries(queueFile).filter(([field]) => field !== name));
    expect(parseQueueFile(withoutIt)).toEqual({
      parsed: false,
      reason: expect.stringContaining(name) as string,
    });
  });

  test("refuses a field it does not know", () => {
    expect(parseQueueFile({ ...queueFile, transcript: "Made-up words" })).toEqual({
      parsed: false,
      reason: expect.stringContaining("transcript") as string,
    });
  });
});
