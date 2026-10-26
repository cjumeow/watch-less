import { DigestFailure } from "../digest-failure.js";
import type { TranscriptSource, VideoDetails } from "./transcript-step.js";

export interface Caption {
  source: Exclude<TranscriptSource, "whisper">;
  language: string;
  tracks: Record<string, unknown>[];
}

/** The metadata is external JSON, never trusted as a TypeScript object. */
export function inspectVideo(value: unknown): {
  details: VideoDetails;
  language: string | undefined;
  captions: Caption[];
} {
  const info = object(value);
  if (info.is_live === true || info.live_status === "is_live") throw new DigestFailure("Live videos are not supported");
  if (info.live_status === "is_upcoming") throw new DigestFailure("The premiere has not aired yet");
  if (info.availability === "private") throw new DigestFailure("The video is private");
  if (info.availability === "subscriber_only" || info.availability === "premium_only")
    throw new DigestFailure("Members-only videos are not supported");
  if (typeof info.age_limit === "number" && info.age_limit > 0)
    throw new DigestFailure("Age-restricted videos are not supported");
  if (typeof info.duration === "number" && info.duration > 3600)
    throw new DigestFailure("The video is longer than one hour");
  if (typeof info.duration !== "number" || !Number.isFinite(info.duration) || info.duration < 0)
    throw new DigestFailure("Video details are unavailable");
  const automatic = object(info.automatic_captions);
  const originalKey = Object.keys(automatic).find(
    (key) => key.endsWith("-orig") && usableTracks(automatic[key]).length > 0,
  );
  const formats = Array.isArray(info.formats) ? info.formats.map(object) : [];
  const originalAudio = formats.find(
    (format) =>
      format.acodec !== "none" &&
      typeof format.language === "string" &&
      typeof format.language_preference === "number" &&
      format.language_preference >= 10,
  );
  const language =
    originalKey?.replace(/-orig$/, "") ??
    (typeof originalAudio?.language === "string" ? originalAudio.language : undefined) ??
    (typeof info.language === "string" ? info.language : undefined);
  const captions: Caption[] = [];
  for (const [field, source] of [
    ["subtitles", "subtitles"],
    ["automatic_captions", "automatic-captions"],
  ] as const) {
    for (const [key, tracks] of Object.entries(object(info[field]))) {
      const usable = usableTracks(tracks);
      if (
        language !== undefined &&
        key
          .replace(/-orig$/, "")
          .toLowerCase()
          .split("-")[0] === language.toLowerCase().split("-")[0] &&
        usable.length > 0 &&
        /^[a-zA-Z][a-zA-Z0-9-]*$/.test(key)
      ) {
        if (source === "automatic-captions" && originalKey && key !== originalKey) continue;
        captions.push({ source, language: key, tracks: usable });
      }
    }
  }
  return {
    details: {
      title: typeof info.title === "string" ? info.title : "",
      channel: typeof info.channel === "string" ? info.channel : "",
      channelUrl: [info.uploader_url, info.channel_url].find((url): url is string => typeof url === "string") ?? "",
      durationSeconds: info.duration,
      description: typeof info.description === "string" ? info.description : "",
    },
    language,
    captions,
  };
}

export function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function usableTracks(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(object).filter((track) => {
    if (track.ext !== "vtt" || typeof track.url !== "string") return false;
    try {
      const url = new URL(track.url);
      return url.protocol === "https:" && !url.searchParams.has("tlang");
    } catch {
      return false;
    }
  });
}
