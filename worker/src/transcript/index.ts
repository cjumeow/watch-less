import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DigestFailure } from "../digest-failure.js";
import { parseCaptions } from "./captions.js";
import { inspectVideo, object } from "./video.js";
import type { Transcript, TranscriptStep } from "./transcript-step.js";

export type * from "./transcript-step.js";
const execute = promisify(execFile);
const YT_DLP = ["--ignore-config", "--js-runtimes", "node", "--no-playlist", "--no-warnings", "--no-progress"];

export function createTranscriptStep(): TranscriptStep {
  return {
    async checkVideo(videoId) {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const info = await readMetadata(url);
      const inspected = inspectVideo(info);
      return {
        details: inspected.details,
        async getTranscript(): Promise<Transcript> {
          const folder = await mkdtemp(join(tmpdir(), "yt-digest-transcript-"));
          try {
            for (const caption of inspected.captions) {
              try {
                const infoFile = join(folder, "video.json");
                await writeFile(
                  infoFile,
                  JSON.stringify({
                    id: videoId,
                    title: inspected.details.title,
                    extractor: "youtube",
                    webpage_url: url,
                    formats: object(info).formats,
                    subtitles: caption.source === "subtitles" ? { [caption.language]: caption.tracks } : {},
                    automatic_captions:
                      caption.source === "automatic-captions" ? { [caption.language]: caption.tracks } : {},
                  }),
                  { mode: 0o600 },
                );
                await execute(
                  "yt-dlp",
                  [
                    ...YT_DLP,
                    "--quiet",
                    "--force-overwrites",
                    "--skip-download",
                    "--ignore-no-formats-error",
                    caption.source === "subtitles" ? "--write-subs" : "--write-auto-subs",
                    "--sub-langs",
                    caption.language,
                    "--sub-format",
                    "vtt",
                    "--output",
                    join(folder, "captions.%(ext)s"),
                    "--load-info-json",
                    infoFile,
                  ],
                  { timeout: 120_000 },
                );
                const lines = parseCaptions(
                  await readFile(join(folder, `captions.${caption.language}.vtt`), "utf8"),
                  caption.source === "automatic-captions",
                );
                if (lines.length > 0) return { source: caption.source, lines };
              } catch {
                // A listed track may be unavailable or malformed. Try the next source, never a translation.
              }
            }
            await execute(
              "yt-dlp",
              [
                ...YT_DLP,
                "--quiet",
                "--format",
                "bestaudio/best",
                "--extract-audio",
                "--audio-format",
                "wav",
                "--output",
                join(folder, "audio.%(ext)s"),
                "--",
                url,
              ],
              { timeout: 300_000 },
            );
            await execute(
              "mlx_whisper",
              [
                join(folder, "audio.wav"),
                "--model",
                "mlx-community/whisper-large-v3-turbo",
                "--task",
                "transcribe",
                "--output-format",
                "json",
                "--output-dir",
                folder,
                "--output-name",
                "transcript",
                "--verbose",
                "False",
              ],
              { timeout: 1_800_000 },
            );
            const answer = parsePythonJson(await readFile(join(folder, "transcript.json"), "utf8"));
            const segments = object(answer).segments;
            if (!Array.isArray(segments)) throw new Error("Whisper did not return timed segments");
            let previousStart = 0;
            const lines = segments
              .map((value: unknown) => {
                const segment = object(value);
                if (
                  typeof segment.start !== "number" ||
                  !Number.isFinite(segment.start) ||
                  segment.start < previousStart ||
                  typeof segment.text !== "string"
                )
                  throw new Error("Whisper returned an invalid timed segment");
                previousStart = segment.start;
                return { startSeconds: segment.start, text: segment.text.replace(/\s+/g, " ").trim() };
              })
              .filter((line) => line.text.length > 0);
            if (lines.length === 0) throw new DigestFailure("No transcript available");
            return { source: "whisper", lines };
          } catch (cause) {
            if (cause instanceof DigestFailure) throw cause;
            throw new DigestFailure("No transcript available", { cause });
          } finally {
            await rm(folder, { recursive: true, force: true });
          }
        },
      };
    },
  };
}

async function readMetadata(url: string): Promise<unknown> {
  try {
    const { stdout } = await execute(
      "yt-dlp",
      [...YT_DLP, "--skip-download", "--dump-single-json", "--ignore-no-formats-error", "--", url],
      { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
    );
    return JSON.parse(stdout) as unknown;
  } catch (cause) {
    const stderr = cause instanceof Error && "stderr" in cause ? String(cause.stderr) : "";
    const reasons: [RegExp, string][] = [
      [/private video/i, "The video is private"],
      [/members.only|join this channel/i, "Members-only videos are not supported"],
      [/confirm your age|age.restricted/i, "Age-restricted videos are not supported"],
      [/premieres in|live event will begin/i, "The premiere has not aired yet"],
    ];
    const reason = reasons.find(([pattern]) => pattern.test(stderr))?.[1] ?? "Could not read video details";
    throw new DigestFailure(reason, { cause });
  }
}

/**
 * Parses JSON that Python's json module wrote, which writes NaN, Infinity and -Infinity, as Whisper does for a
 * segment's scores, though JSON has no such values. They become null outside strings; strings are left as they are,
 * since a transcript's own words may say "NaN".
 */
export function parsePythonJson(text: string): unknown {
  return JSON.parse(
    text.replace(/"(?:[^"\\]|\\.)*"|-?Infinity|NaN/g, (token) => (token.startsWith('"') ? token : "null")),
  ) as unknown;
}
