// The public surface of @yt-digest/shared: the messages and the queue file the extension, the native host and the
// worker exchange, the parsers each program runs on what it receives, the languages, models and destinations a digest can be
// written with, and the text the button shows.
export { BUTTON_MESSAGES, type ButtonMessage } from "./button-message.js";
export type { Parsed } from "./fields.js";
export { parseQueueFile, type QueueFile } from "./queue-file.js";
export { parseReply, type Reply, type ReplyError } from "./reply.js";
export { parseRequest, type RequestMessage } from "./request.js";
export {
  DEFAULT_SETTINGS,
  DESTINATIONS,
  isLanguageId,
  isModelId,
  isNotionPageId,
  LANGUAGES,
  PROVIDERS,
  providerOf,
  type DestinationId,
  type DigestSettings,
  type GivenSettings,
  type LanguageId,
  type ModelId,
  type ProviderId,
} from "./settings.js";
