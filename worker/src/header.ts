/** What the header says about one digest. */
export interface HeaderDetails {
  videoId: string;
  title: string;
  channel: string;
  /** The channel's page as YouTube gives it; empty when it gives none, and the channel is then written without a link. */
  channelUrl: string;
  durationSeconds: number;
  /** As the queue file holds it, in UTC. */
  requestedAt: string;
  model: string;
}

/** A channel page the header links to: on YouTube, with nothing that could end a Markdown link or start another. */
const CHANNEL_URL = /^https:\/\/www\.youtube\.com\/[\w@%./-]+$/;

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
    `- Channel: ${formatChannel(details.channel, details.channelUrl)}`,
    `- Length: ${formatDuration(details.durationSeconds)}`,
    `- Added: ${formatLocalTime(details.requestedAt, timeZone)}`,
    `- Model: ${oneLine(details.model)}`,
    "",
  ].join("\n");
}

/** The title and channel come from YouTube, so a line break in them must not start a line of its own. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The channel's name, linked to its page when YouTube gives one the header can trust. */
function formatChannel(name: string, url: string): string {
  if (!CHANNEL_URL.test(url)) return oneLine(name);
  return `[${oneLine(name).replace(/[\\[\]]/g, "\\$&")}](${url})`;
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
