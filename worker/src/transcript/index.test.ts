import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTranscriptStep } from "./index.js";

export const metadata = {
  id: "aaaaaaaaaaa",
  title: "A made-up video",
  channel: "A made-up channel",
  uploader_url: "https://www.youtube.com/@made-up-channel",
  channel_url: "https://www.youtube.com/channel/UCmadeupchannel",
  description: "A made-up description.\nThe made-up repo: https://github.com/example/made-up",
  duration: 10,
  language: "en",
  formats: [{ format_id: "fake", url: "https://example.invalid/audio", ext: "m4a", acodec: "aac", vcodec: "none" }],
  subtitles: { en: [{ ext: "vtt", url: "https://www.youtube.com/api/timedtext?lang=en" }] },
};

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "yt-digest-transcript-test-"));
  const script =
    `#!${process.execPath}\n` +
    String.raw`
const fs = require("node:fs"), path = require("node:path");
const root = process.env.FAKE_TRANSCRIPT_DIR;
const scenario = JSON.parse(fs.readFileSync(path.join(root, "scenario.json"), "utf8"));
const name = path.basename(process.argv[1]), args = process.argv.slice(2);
const option = key => args[args.indexOf(key) + 1];
const call = { name, args, cwd: process.cwd() };
if (args.includes("--load-info-json")) call.info = JSON.parse(fs.readFileSync(option("--load-info-json"), "utf8"));
fs.appendFileSync(path.join(root, "calls.jsonl"), JSON.stringify(call) + "\n");
if (args.includes("--dump-single-json")) {
  if (scenario.metadataError) { console.error(scenario.metadataError); process.exit(1); }
  console.log(JSON.stringify(scenario.metadata));
} else if (name === "yt-dlp" && args.includes("--skip-download")) {
  if (scenario.captionError) { console.error("A made-up caption download failure"); process.exit(1); }
  const lang = option("--sub-langs");
  const out = option("--output").replace("%(ext)s", lang + ".vtt");
  fs.writeFileSync(out, scenario.caption ?? "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nA made-up line\n");
} else if (name === "yt-dlp") {
  if (scenario.audioError) { console.error("A made-up audio download failure"); process.exit(1); }
  fs.writeFileSync(option("--output").replace("%(ext)s", "wav"), "made-up audio");
} else {
  if (scenario.whisperError) { console.error("A made-up Whisper failure"); process.exit(1); }
  fs.writeFileSync(path.join(option("--output-dir"), option("--output-name") + ".json"), scenario.whisperRaw ?? JSON.stringify(scenario.whisper ?? { segments: [{ start: 1.5, text: " 原文逐字稿 " }] }));
}
`;
  for (const name of ["yt-dlp", "mlx_whisper"]) {
    await writeFile(join(folder, name), script);
    await chmod(join(folder, name), 0o700);
  }
  vi.stubEnv("PATH", `${folder}:${process.env.PATH ?? ""}`);
  vi.stubEnv("FAKE_TRANSCRIPT_DIR", folder);
  await scenario();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});
async function scenario(changes: Record<string, unknown> = {}) {
  await writeFile(join(folder, "scenario.json"), JSON.stringify({ metadata, ...changes }));
}
interface Call {
  name: string;
  args: string[];
  cwd: string;
  info?: Record<string, unknown>;
}
async function calls(): Promise<Call[]> {
  return (await readFile(join(folder, "calls.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Call);
}

test.each([undefined, null, 42])("gives an empty description when yt-dlp gives %s", async (description) => {
  await scenario({ metadata: { ...metadata, description } });
  expect((await createTranscriptStep().checkVideo("aaaaaaaaaaa")).details.description).toBe("");
});

test("checks a video without downloading and returns the original-language subtitles", async () => {
  const checked = await createTranscriptStep().checkVideo("aaaaaaaaaaa");
  expect(checked.details).toEqual({
    title: "A made-up video",
    channel: "A made-up channel",
    channelUrl: "https://www.youtube.com/@made-up-channel",
    durationSeconds: 10,
    description: "A made-up description.\nThe made-up repo: https://github.com/example/made-up",
  });
  expect(await checked.getTranscript()).toEqual({
    source: "subtitles",
    lines: [{ startSeconds: 1, text: "A made-up line" }],
  });
  const received = await calls();
  expect(received).toHaveLength(2);
  expect(received[0]?.args).toEqual(
    expect.arrayContaining([
      "--dump-single-json",
      "--skip-download",
      "--ignore-config",
      "--no-playlist",
      "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    ]),
  );
  expect(received[1]?.args).toEqual(
    expect.arrayContaining([
      "--skip-download",
      "--write-subs",
      "--sub-langs",
      "en",
      "--sub-format",
      "vtt",
      "--load-info-json",
    ]),
  );
  const output = received[1]?.args;
  const contentPath = output?.[output.indexOf("--load-info-json") + 1] ?? "missing-metadata-file";
  await expect(access(contentPath)).rejects.toThrow();
});

test("uses original automatic captions without downloading machine translations", async () => {
  await scenario({
    metadata: {
      ...metadata,
      subtitles: {},
      automatic_captions: {
        "en-orig": metadata.subtitles.en,
        fr: [{ ext: "vtt", url: "https://www.youtube.com/api/timedtext?lang=en&tlang=fr" }],
      },
    },
    caption: "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nOld line\n\n00:00:02.000 --> 00:00:05.000\nOld line\nNew line\n",
  });
  const checked = await createTranscriptStep().checkVideo("aaaaaaaaaaa");
  expect(await checked.getTranscript()).toEqual({
    source: "automatic-captions",
    lines: [
      { startSeconds: 1, text: "Old line" },
      { startSeconds: 2, text: "New line" },
    ],
  });
  const received = await calls();
  expect(received[1]?.args).toContain("--write-auto-subs");
  expect(received[1]?.info?.automatic_captions).toEqual({ "en-orig": metadata.subtitles.en });
});

test("transcribes downloaded audio in its original language when captions are absent", async () => {
  await scenario({ metadata: { ...metadata, subtitles: {} } });
  const checked = await createTranscriptStep().checkVideo("aaaaaaaaaaa");
  expect(await checked.getTranscript()).toEqual({
    source: "whisper",
    lines: [{ startSeconds: 1.5, text: "原文逐字稿" }],
  });
  const received = await calls();
  expect(received.map((call) => call.name)).toEqual(["yt-dlp", "yt-dlp", "mlx_whisper"]);
  expect(received[1]?.args).toEqual(expect.arrayContaining(["--extract-audio", "--audio-format", "wav"]));
  expect(received[2]?.args).toEqual(
    expect.arrayContaining([
      "--model",
      "mlx-community/whisper-large-v3-turbo",
      "--task",
      "transcribe",
      "--output-format",
      "json",
    ]),
  );
  const args = received[2]?.args;
  await expect(access(args?.[args.indexOf("--output-dir") + 1] ?? "missing-output-dir")).rejects.toThrow();
});

test("reads Whisper's answer with NaN and Infinity, which Python writes and JSON does not allow", async () => {
  await scenario({
    metadata: { ...metadata, subtitles: {} },
    whisperRaw:
      '{"segments": [{"start": 1.5, "text": " Not NaN, Infinity ", "avg_logprob": NaN, "compression_ratio": Infinity, "no_speech_prob": -Infinity}]}',
  });
  const checked = await createTranscriptStep().checkVideo("aaaaaaaaaaa");
  expect(await checked.getTranscript()).toEqual({
    source: "whisper",
    lines: [{ startSeconds: 1.5, text: "Not NaN, Infinity" }],
  });
});

test("falls back to audio when the advertised subtitles cannot be downloaded", async () => {
  await scenario({ captionError: true });
  const checked = await createTranscriptStep().checkVideo("aaaaaaaaaaa");
  expect(await checked.getTranscript()).toMatchObject({ source: "whisper" });
  expect((await calls()).map((call) => call.name)).toEqual(["yt-dlp", "yt-dlp", "yt-dlp", "mlx_whisper"]);
});

test.each([
  ["Private video. Sign in if you've been granted access to this video", "The video is private"],
  ["Join this channel to get access to members-only content", "Members-only videos are not supported"],
  [
    "Sign in to confirm your age. This video may be inappropriate for some users",
    "Age-restricted videos are not supported",
  ],
  ["This live event will begin in 2 hours", "The premiere has not aired yet"],
  ["An unknown extractor error", "Could not read video details"],
])("reports a notification reason when yt-dlp fails before returning JSON: %s", async (message, reason) => {
  await scenario({ metadataError: `ERROR: [youtube] aaaaaaaaaaa: ${message}` });
  await expect(createTranscriptStep().checkVideo("aaaaaaaaaaa")).rejects.toMatchObject({
    name: "DigestFailure",
    reason,
  });
  expect(await calls()).toHaveLength(1);
});

test("reports a transcript failure and removes temporary audio when Whisper fails", async () => {
  await scenario({ metadata: { ...metadata, subtitles: {} }, whisperError: true });
  const checked = await createTranscriptStep().checkVideo("aaaaaaaaaaa");
  await expect(checked.getTranscript()).rejects.toMatchObject({
    name: "DigestFailure",
    reason: "No transcript available",
  });
  const received = await calls();
  const args = received[2]?.args;
  await expect(access(args?.[args.indexOf("--output-dir") + 1] ?? "missing-output-dir")).rejects.toThrow();
});

test.each([
  { segments: [{ start: "wrong", text: "A made-up line" }] },
  { segments: [{ start: -1, text: "A made-up line" }] },
  { segments: [{ start: 1, text: 123 }] },
  {
    segments: [
      { start: 2, text: "Second" },
      { start: 1, text: "First" },
    ],
  },
])("rejects malformed Whisper segments instead of passing invalid transcript lines: %j", async (whisper) => {
  await scenario({ metadata: { ...metadata, subtitles: {} }, whisper });
  const checked = await createTranscriptStep().checkVideo("aaaaaaaaaaa");
  await expect(checked.getTranscript()).rejects.toMatchObject({ reason: "No transcript available" });
});
