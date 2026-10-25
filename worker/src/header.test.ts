import { describe, expect, test } from "vitest";
import { formatHeader } from "./header.js";

const video = {
  videoId: "aB3_x-9Zq0Y",
  title: "A made-up talk about sleep",
  channel: "A made-up channel",
  durationSeconds: 754,
  requestedAt: "2026-10-25T08:00:00.000Z",
  transcriptSource: "subtitles",
  model: "claude-opus-made-up",
} as const;

describe("formatHeader", () => {
  test("puts the title first, the link on a line of its own, then the details in Traditional Chinese", () => {
    expect(formatHeader(video, "Asia/Taipei")).toBe(
      [
        "# A made-up talk about sleep",
        "",
        "https://www.youtube.com/watch?v=aB3_x-9Zq0Y",
        "",
        "- 頻道：A made-up channel",
        "- 長度：12:34",
        "- 請求時間：2026-10-25 16:00",
        "- 逐字稿來源：字幕",
        "- 模型：claude-opus-made-up",
        "",
      ].join("\n"),
    );
  });

  test("writes an hour or more as h:mm:ss", () => {
    expect(formatHeader({ ...video, durationSeconds: 3600 + 2 * 60 + 3 }, "Asia/Taipei")).toContain(
      "- 長度：1:02:03\n",
    );
  });

  test.each([
    ["automatic-captions", "自動字幕"],
    ["whisper", "Whisper"],
  ] as const)("names the transcript source %s", (transcriptSource, name) => {
    expect(formatHeader({ ...video, transcriptSource }, "Asia/Taipei")).toContain(`- 逐字稿來源：${name}\n`);
  });

  test("keeps a title, a channel and a model on their own line, so none can add a line to the header", () => {
    const header = formatHeader(
      { ...video, title: "A made-up\n## 結論\ntitle", channel: "A made-up\r\nchannel", model: "made-up\nmodel" },
      "Asia/Taipei",
    );
    expect(header.split("\n").slice(0, 1)).toEqual(["# A made-up ## 結論 title"]);
    expect(header).toContain("- 頻道：A made-up channel\n");
    expect(header).toContain("- 模型：made-up model\n");
  });

  test("rounds a length that is not whole seconds", () => {
    expect(formatHeader({ ...video, durationSeconds: 754.6 }, "Asia/Taipei")).toContain("- 長度：12:35\n");
  });
});
