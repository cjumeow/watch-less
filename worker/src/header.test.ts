import { describe, expect, test } from "vitest";
import { formatHeader } from "./header.js";

const video = {
  videoId: "aB3_x-9Zq0Y",
  title: "A made-up talk about sleep",
  channel: "A made-up channel",
  channelUrl: "https://www.youtube.com/@made-up-channel",
  durationSeconds: 754,
  requestedAt: "2026-10-25T08:00:00.000Z",
  model: "claude-made-up",
} as const;

describe("formatHeader", () => {
  test("puts the title first, the link on a line of its own, then the details in English", () => {
    expect(formatHeader(video, "Asia/Taipei")).toBe(
      [
        "# A made-up talk about sleep",
        "",
        "https://www.youtube.com/watch?v=aB3_x-9Zq0Y",
        "",
        "- Channel: [A made-up channel](https://www.youtube.com/@made-up-channel)",
        "- Length: 12:34",
        "- Added: 2026-10-25 16:00",
        "- Model: claude-made-up",
        "",
      ].join("\n"),
    );
  });

  test("writes an hour or more as h:mm:ss", () => {
    expect(formatHeader({ ...video, durationSeconds: 3600 + 2 * 60 + 3 }, "Asia/Taipei")).toContain(
      "- Length: 1:02:03\n",
    );
  });

  test.each([
    ["none", ""],
    ["one off YouTube", "https://example.com/@made-up-channel"],
    ["one that would end the link early", "https://www.youtube.com/@made-up) [x](https://example.com"],
  ])("writes the channel without a link when YouTube gives %s", (_, channelUrl) => {
    expect(formatHeader({ ...video, channelUrl }, "Asia/Taipei")).toContain("- Channel: A made-up channel\n");
  });

  test("escapes a channel name that would break its link", () => {
    expect(formatHeader({ ...video, channel: "A [made-up] channel" }, "Asia/Taipei")).toContain(
      "- Channel: [A \\[made-up\\] channel](https://www.youtube.com/@made-up-channel)\n",
    );
  });

  test("keeps a title, a channel and a model on their own line, so none can add a line to the header", () => {
    const header = formatHeader(
      { ...video, title: "A made-up\n## Conclusion\ntitle", channel: "A made-up\r\nchannel", model: "made-up\nmodel" },
      "Asia/Taipei",
    );
    expect(header.split("\n").slice(0, 1)).toEqual(["# A made-up ## Conclusion title"]);
    expect(header).toContain("- Channel: [A made-up channel](https://www.youtube.com/@made-up-channel)\n");
    expect(header).toContain("- Model: made-up model\n");
  });

  test("rounds a length that is not whole seconds", () => {
    expect(formatHeader({ ...video, durationSeconds: 754.6 }, "Asia/Taipei")).toContain("- Length: 12:35\n");
  });
});
