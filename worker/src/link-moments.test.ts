import { expect, test } from "vitest";
import { linkMoments } from "./link-moments.js";

const VIDEO = "https://www.youtube.com/watch?v=aB3_x-9Zq0Y";

test("links a main argument whose time range has no link, to the range's start", () => {
  expect(linkMoments("- [0:47–1:31] **A made-up point**: The speaker says so.", VIDEO)).toBe(
    `- [0:47–1:31](${VIDEO}&t=47s) **A made-up point**: The speaker says so.`,
  );
});

test("links a bare moment, and one past an hour", () => {
  expect(linkMoments("named at [9:07], and again at [1:02:03].", VIDEO)).toBe(
    `named at [9:07](${VIDEO}&t=547s), and again at [1:02:03](${VIDEO}&t=3723s).`,
  );
});

test("leaves a moment that already has its link as it is", () => {
  const linked = `- [12:34–15:10](${VIDEO}&t=754s) **A made-up point**: [3:12](${VIDEO}&t=192s)`;
  expect(linkMoments(linked, VIDEO)).toBe(linked);
});

test("accepts a hyphen between the ends of a range", () => {
  expect(linkMoments("- [1:00-2:30] **Point**", VIDEO)).toBe(`- [1:00-2:30](${VIDEO}&t=60s) **Point**`);
});

test.each([
  ["a link's text that is not a moment", "see [the book](https://example.com/book)"],
  ["a number in brackets", "as in [12]"],
  ["seconds past 59", "at [1:75]"],
  ["a moment inside inline code", "run `[0:47]`"],
])("leaves %s alone", (_case, text) => {
  expect(linkMoments(text, VIDEO)).toBe(text);
});
