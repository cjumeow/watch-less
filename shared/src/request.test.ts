import { describe, expect, test } from "vitest";
import { parseRequest } from "@yt-digest/shared";

describe("parseRequest", () => {
  test("accepts a video ID and a title", () => {
    expect(parseRequest({ videoId: "aB3_x-9Zq0Y", title: "A made-up video" })).toEqual({
      parsed: true,
      value: { videoId: "aB3_x-9Zq0Y", title: "A made-up video" },
    });
  });

  test.each([
    ["10 characters", "aB3_x-9Zq0"],
    ["12 characters", "aB3_x-9Zq0YY"],
    ["a slash", "aB3_x/9Zq0Y"],
    ["a dot", "aB3_x.9Zq0Y"],
    ["a number", 12345678901],
  ])("refuses a video ID of %s", (_case, videoId) => {
    expect(parseRequest({ videoId, title: "A made-up video" })).toEqual({
      parsed: false,
      reason: expect.stringContaining("videoId") as string,
    });
  });

  test.each([
    ["empty", ""],
    ["500 characters long", "x".repeat(500)],
    ["500 characters outside the Basic Multilingual Plane", "\u{1F600}".repeat(500)],
  ])("accepts a title that is %s", (_case, title) => {
    expect(parseRequest({ videoId: "aB3_x-9Zq0Y", title })).toEqual({
      parsed: true,
      value: { videoId: "aB3_x-9Zq0Y", title },
    });
  });

  test.each([
    ["501 characters long", "x".repeat(501)],
    ["a number", 42],
  ])("refuses a title that is %s", (_case, title) => {
    expect(parseRequest({ videoId: "aB3_x-9Zq0Y", title })).toEqual({
      parsed: false,
      reason: expect.stringContaining("title") as string,
    });
  });

  test("refuses a request without a title", () => {
    expect(parseRequest({ videoId: "aB3_x-9Zq0Y" })).toEqual({
      parsed: false,
      reason: expect.stringContaining("title") as string,
    });
  });

  test("refuses fields it inherits rather than holds", () => {
    expect(parseRequest(Object.create({ videoId: "aB3_x-9Zq0Y", title: "A made-up video" }))).toMatchObject({
      parsed: false,
    });
  });

  test("refuses a field it does not know", () => {
    expect(parseRequest({ videoId: "aB3_x-9Zq0Y", title: "A made-up video", channel: "A made-up channel" })).toEqual({
      parsed: false,
      reason: expect.stringContaining("channel") as string,
    });
  });

  test.each([
    ["null", null],
    ["a string", "aB3_x-9Zq0Y"],
    ["an array", ["aB3_x-9Zq0Y", "A made-up video"]],
  ])("refuses %s", (_case, input) => {
    expect(parseRequest(input)).toMatchObject({ parsed: false });
  });
});
