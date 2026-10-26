// The popup's choices as chrome.storage.local keeps them: only the language and the model, nothing about videos.

import { DEFAULT_SETTINGS, isLanguageId, isModelId, type DigestSettings } from "@yt-digest/shared";

/** The keys the settings are stored under. */
export const STORAGE_KEYS = ["language", "model"] as const;

/**
 * The settings to send with a request, from whatever storage returned. A value that is missing or no longer parses,
 * such as a model removed from the list, falls back to the default, each on its own.
 */
export function savedSettings(stored: Record<string, unknown>): DigestSettings {
  return {
    language: isLanguageId(stored.language) ? stored.language : DEFAULT_SETTINGS.language,
    model: isModelId(stored.model) ? stored.model : DEFAULT_SETTINGS.model,
  };
}
