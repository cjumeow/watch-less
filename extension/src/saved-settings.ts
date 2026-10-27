// The popup's choices as chrome.storage.local keeps them: the language, the model, the destination and a Notion folder
// page, nothing about videos.

import {
  DEFAULT_SETTINGS,
  DESTINATIONS,
  isLanguageId,
  isModelId,
  isNotionPageId,
  type DigestSettings,
} from "@yt-digest/shared";

/** The keys the settings are stored under. */
export const STORAGE_KEYS = ["language", "model", "destination", "notionFolderPage"] as const;

/** The settings to send with a request: `notionFolderPage` is there only when the developer gave a page. */
export type SavedSettings = DigestSettings & { notionFolderPage?: string };

/**
 * The settings to send with a request, from whatever storage returned. A value that is missing or no longer parses,
 * such as a model removed from the list, falls back to the default, each on its own; no folder page is the default.
 */
export function savedSettings(stored: Record<string, unknown>): SavedSettings {
  return {
    language: isLanguageId(stored.language) ? stored.language : DEFAULT_SETTINGS.language,
    model: isModelId(stored.model) ? stored.model : DEFAULT_SETTINGS.model,
    destination: DESTINATIONS.find((known) => known.id === stored.destination)?.id ?? DEFAULT_SETTINGS.destination,
    ...(isNotionPageId(stored.notionFolderPage) ? { notionFolderPage: stored.notionFolderPage } : {}),
  };
}

const NOTION_LINK = /^https:\/\/(?:www\.|app\.)?notion\.(?:so|com)\/(?:[^?#]*[-/])?([0-9a-f]{32})(?:[?#].*)?$/i;
const DASHED_ID = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i;

/**
 * The page ID in what the developer pasted: a page link, whose last path part ends in the ID, the ID itself, or the
 * ID with hyphens as the API writes it. Empty text gives an empty ID (no folder page); anything else gives `undefined`.
 */
export function notionPageIdFrom(text: string): string | undefined {
  const pasted = text.trim();
  if (pasted === "") return "";
  const link = NOTION_LINK.exec(pasted)?.[1];
  if (link !== undefined) return link.toLowerCase();
  const plain = DASHED_ID.exec(pasted)?.slice(1).join("") ?? pasted;
  return isNotionPageId(plain) ? plain.toLowerCase() : undefined;
}
