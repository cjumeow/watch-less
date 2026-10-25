import { expect, test } from "vitest";
import { parseCaptions } from "./captions.js";

test("turns VTT cues into timed transcript lines, preserving text and decoding entities", () => {
  expect(
    parseCaptions(
      "WEBVTT\nKind: captions\nLanguage: zh-TW\n\nintro\n00:00:01.250 --> 00:00:03.000 align:start position:0%\n<c>虛構 &amp; 測試</c>\n第二行\n\n01:00:00.000 --> 01:00:01.000\nEnd &#33;\n",
    ),
  ).toEqual([
    { startSeconds: 1.25, text: "虛構 & 測試 第二行" },
    { startSeconds: 3600, text: "End !" },
  ]);
});

test("drops rolling lines only while cues overlap, keeping a later repeated sentence", () => {
  expect(
    parseCaptions(
      `WEBVTT

00:00:01.000 --> 00:00:04.000
<00:00:01.000><c>Hello</c> world

00:00:02.000 --> 00:00:05.000
Hello world
A new line

00:00:03.000 --> 00:00:06.000
A new line

00:00:10.000 --> 00:00:12.000
Hello world
`,
      true,
    ),
  ).toEqual([
    { startSeconds: 1, text: "Hello world" },
    { startSeconds: 2, text: "A new line" },
    { startSeconds: 10, text: "Hello world" },
  ]);
});

test.each([
  "WEBVTT\n\n00:99:00.000 --> 00:99:01.000\nWrong minutes\n",
  "WEBVTT\n\n00:00:02.000 --> 00:00:01.000\nBackwards\n",
  "WEBVTT\n\n00:00:02.000 --> 00:00:03.000\nSecond\n\n00:00:01.000 --> 00:00:02.000\nFirst\n",
])("refuses malformed cue times instead of returning misleading timestamps", (vtt) => {
  expect(() => parseCaptions(vtt)).toThrow("Invalid VTT timestamp");
});

test("drops the adjacent 10ms repaint cues used by rolling automatic captions", () => {
  expect(
    parseCaptions(
      `WEBVTT

00:00:00.000 --> 00:00:02.000
First line

00:00:02.000 --> 00:00:02.010
First line

00:00:02.010 --> 00:00:04.000
First line
Second line
`,
      true,
    ),
  ).toEqual([
    { startSeconds: 0, text: "First line" },
    { startSeconds: 2.01, text: "Second line" },
  ]);
});
