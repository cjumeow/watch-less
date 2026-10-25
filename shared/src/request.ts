import { isTitle, isVideoId, readFields, TITLE_RULE, VIDEO_ID_RULE, type Parsed } from "./fields.js";

/** What the extension sends the native host for one request. */
export interface RequestMessage {
  videoId: string;
  title: string;
}

export function parseRequest(input: unknown): Parsed<RequestMessage> {
  const fields = readFields(input, ["videoId", "title"]);
  if (!fields.parsed) return fields;
  const { videoId, title } = fields.value;
  if (!isVideoId(videoId)) return { parsed: false, reason: VIDEO_ID_RULE };
  if (!isTitle(title)) return { parsed: false, reason: TITLE_RULE };
  return { parsed: true, value: { videoId, title } };
}
