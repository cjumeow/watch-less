import { expect, test } from "vitest";
import { inspectVideo } from "./video.js";

const track = (language: string) => [{ ext: "vtt", url: `https://www.youtube.com/api/timedtext?lang=${language}` }];
const video = { title: "A made-up video", channel: "A made-up channel", duration: 600, language: "en" };

test("prefers subtitles in the original language before original automatic captions", () => {
  expect(
    inspectVideo({
      ...video,
      subtitles: { en: track("en"), fr: track("fr") },
      automatic_captions: { "en-orig": track("en") },
    }),
  ).toEqual({
    details: {
      title: "A made-up video",
      channel: "A made-up channel",
      channelUrl: "",
      durationSeconds: 600,
      description: "",
    },
    language: "en",
    captions: [
      { source: "subtitles", language: "en", tracks: track("en") },
      { source: "automatic-captions", language: "en-orig", tracks: track("en") },
    ],
  });
});

test("uses the original caption language and never selects translated or unsupported tracks", () => {
  const translated = [{ ext: "vtt", url: "https://www.youtube.com/api/timedtext?lang=ja&tlang=en" }];
  expect(
    inspectVideo({
      ...video,
      language: undefined,
      subtitles: { ja: track("ja"), en: translated },
      automatic_captions: {
        "ja-orig": track("ja"),
        en: translated,
        "en-orig": translated,
        ja: track("ja"),
        fr: [{ ext: "json3", url: "https://www.youtube.com/api/timedtext?lang=fr" }],
      },
    }),
  ).toMatchObject({
    language: "ja",
    captions: [
      { source: "subtitles", language: "ja", tracks: track("ja") },
      { source: "automatic-captions", language: "ja-orig", tracks: track("ja") },
    ],
  });
});

test.each([
  [{ live_status: "is_live" }, "Live videos are not supported"],
  [{ is_live: true }, "Live videos are not supported"],
  [{ live_status: "is_upcoming" }, "The premiere has not aired yet"],
  [{ availability: "private" }, "The video is private"],
  [{ availability: "subscriber_only" }, "Members-only videos are not supported"],
  [{ availability: "premium_only" }, "Members-only videos are not supported"],
  [{ age_limit: 18 }, "Age-restricted videos are not supported"],
  [{ duration: 3600.1 }, "The video is longer than one hour"],
])("refuses an unsupported video with a notification reason: %j", (changes, reason) => {
  expect(() => inspectVideo({ ...video, ...changes })).toThrow(reason);
});

test("rejects incomplete video metadata instead of treating unknown duration as a short video", () => {
  expect(() => inspectVideo({ title: "A made-up video" })).toThrow("Video details are unavailable");
});

test("uses the original audio format's language when the video has no top-level language", () => {
  expect(
    inspectVideo({
      ...video,
      language: undefined,
      duration: 3600,
      formats: [
        { acodec: "opus", language: "en", language_preference: -1 },
        { acodec: "opus", language: "ja", language_preference: 10 },
      ],
      subtitles: { ja: track("ja"), en: track("en") },
    }),
  ).toMatchObject({
    details: { durationSeconds: 3600 },
    language: "ja",
    captions: [{ source: "subtitles", language: "ja" }],
  });
});

test("accepts a regional subtitle variant of the original language", () => {
  expect(
    inspectVideo({ ...video, language: "zh", subtitles: { "zh-Hant": track("zh-Hant"), en: track("en") } }),
  ).toMatchObject({ captions: [{ source: "subtitles", language: "zh-Hant" }] });
});
