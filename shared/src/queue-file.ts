import { isTitle, isVideoId, readFields, TITLE_RULE, VIDEO_ID_RULE, type Parsed } from "./fields.js";
import { readSettings, type DigestSettings } from "./settings.js";

/**
 * What the native host writes to `<videoId>.json` in the queue folder, and the worker reads, with the request's
 * settings when it has them.
 */
export interface QueueFile extends Partial<DigestSettings> {
  videoId: string;
  title: string;
  /** When the request was received, in UTC, as `Date.prototype.toISOString()` writes it. */
  requestedAt: string;
}

// Only the exact form toISOString writes, so every queue file sorts and reads the same way. Writing the date back
// out also refuses a date that does not exist, such as February 30, which Date would otherwise roll over.
function isRequestedAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

export function parseQueueFile(input: unknown): Parsed<QueueFile> {
  const fields = readFields(input, ["videoId", "title", "requestedAt", "language", "model"]);
  if (!fields.parsed) return fields;
  const { videoId, title, requestedAt, language, model } = fields.value;
  if (!isVideoId(videoId)) return { parsed: false, reason: VIDEO_ID_RULE };
  if (!isTitle(title)) return { parsed: false, reason: TITLE_RULE };
  if (!isRequestedAt(requestedAt)) {
    return { parsed: false, reason: "requestedAt is not a UTC time as Date.prototype.toISOString() writes it" };
  }
  const settings = readSettings(language, model);
  if (!settings.parsed) return settings;
  return { parsed: true, value: { videoId, title, requestedAt, ...settings.value } };
}
