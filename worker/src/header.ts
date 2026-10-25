import type { TranscriptSource } from "./transcript/transcript-step.js";

/** What the header says about one digest. */
export interface HeaderDetails {
  videoId: string;
  title: string;
  channel: string;
  durationSeconds: number;
  /** As the queue file holds it, in UTC. */
  requestedAt: string;
  transcriptSource: TranscriptSource;
  model: string;
}

const SOURCE_NAMES: Record<TranscriptSource, string> = {
  subtitles: "字幕",
  "automatic-captions": "自動字幕",
  whisper: "Whisper",
};

export function videoLink(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * The lines above the model's sections, written by the worker so the transcript cannot change them. The title comes
 * first because the destination makes the first line, `# <title>`, the card's title.
 */
export function formatHeader(details: HeaderDetails, timeZone?: string): string {
  return [
    `# ${oneLine(details.title)}`,
    "",
    videoLink(details.videoId),
    "",
    `- 頻道：${oneLine(details.channel)}`,
    `- 長度：${formatDuration(details.durationSeconds)}`,
    `- 請求時間：${formatLocalTime(details.requestedAt, timeZone)}`,
    `- 逐字稿來源：${SOURCE_NAMES[details.transcriptSource]}`,
    `- 模型：${oneLine(details.model)}`,
    "",
  ].join("\n");
}

/** The title and channel come from YouTube, so a line break in them must not start a line of its own. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** `m:ss` under an hour and `h:mm:ss` from an hour on, as the transcript's timestamps are written. */
function formatDuration(duration: number): string {
  const totalSeconds = Math.round(duration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${String(minutes)}:${seconds}`;
}

/** `yyyy-mm-dd hh:mm` in the given zone, this Mac's own when none is given. */
function formatLocalTime(utc: string, timeZone?: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(utc))
      .map((part) => [part.type, part.value]),
  ) as Record<Intl.DateTimeFormatPartTypes, string>;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}
