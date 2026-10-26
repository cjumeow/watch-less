import { isTitle, isVideoId, readFields, TITLE_RULE, VIDEO_ID_RULE, type Parsed } from "./fields.js";
import { readSettings, type DigestSettings } from "./settings.js";

/** What the extension sends the native host for one request, with the popup's settings when it has them. */
export interface RequestMessage extends Partial<DigestSettings> {
  videoId: string;
  title: string;
}

export function parseRequest(input: unknown): Parsed<RequestMessage> {
  const fields = readFields(input, ["videoId", "title", "language", "model"]);
  if (!fields.parsed) return fields;
  const { videoId, title, language, model } = fields.value;
  if (!isVideoId(videoId)) return { parsed: false, reason: VIDEO_ID_RULE };
  if (!isTitle(title)) return { parsed: false, reason: TITLE_RULE };
  const settings = readSettings(language, model);
  if (!settings.parsed) return settings;
  return { parsed: true, value: { videoId, title, ...settings.value } };
}
