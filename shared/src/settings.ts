// The choices a digest is written with, as the extension's popup offers them (docs/prototypes/popup.html): the
// language it is written in, the model that writes it, and where it is saved.

import type { Parsed } from "./fields.js";

/**
 * The languages a digest can be written in, in the popup's order: the name the popup shows, the language's own, and
 * its name in English, which the worker adds for the model.
 */
export const LANGUAGES = [
  { id: "en", name: "English", englishName: "English" },
  { id: "zh-Hant", name: "繁體中文", englishName: "Traditional Chinese" },
  { id: "zh-Hans", name: "简体中文", englishName: "Simplified Chinese" },
  { id: "ja", name: "日本語", englishName: "Japanese" },
  { id: "ko", name: "한국어", englishName: "Korean" },
  { id: "es", name: "Español", englishName: "Spanish" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

/**
 * The models a digest can be written with, by provider, in the popup's order. A model's ID is what its command-line
 * tool takes as the model, so only these IDs ever reach one.
 */
export const PROVIDERS = [
  {
    id: "claude",
    name: "Claude",
    defaultModel: "claude-haiku-5-5",
    models: [
      { id: "claude-haiku-5-5", name: "Haiku 5.5", description: "Fastest, uses the least of your plan" },
      { id: "claude-sonnet-5-5", name: "Sonnet 5.5", description: "Balanced speed and depth" },
      { id: "claude-opus-5-5", name: "Opus 5.5", description: "Most capable for complex work" },
      { id: "claude-fable-5-1", name: "Fable 5.1", description: "Newest Claude model" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-6-luna",
    models: [
      { id: "gpt-6-luna", name: "GPT-6 Luna", description: "Most efficient, for summaries and extraction" },
      { id: "gpt-6-sol", name: "GPT-6 Sol", description: "General purpose" },
      { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", description: "Near-Astra quality at lower cost" },
      { id: "gpt-6-astra", name: "GPT-6 Astra", description: "Most capable for complex work" },
    ],
  },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];
export type ModelId = (typeof PROVIDERS)[number]["models"][number]["id"];

/** The destinations a digest can be saved to, in the popup's order. */
export const DESTINATIONS = [
  { id: "heptabase", name: "Heptabase" },
  { id: "notion", name: "Notion" },
] as const;

export type DestinationId = (typeof DESTINATIONS)[number]["id"];

/** The language a digest is written in, the model that writes it, and the destination it is saved to. */
export interface DigestSettings {
  language: LanguageId;
  model: ModelId;
  destination: DestinationId;
}

/**
 * What a digest is written with when its request does not say: English, Claude's default model, and Heptabase. A
 * Notion folder page has no default: without one, a page goes to the Private section.
 */
export const DEFAULT_SETTINGS: DigestSettings = {
  language: "en",
  model: PROVIDERS[0].defaultModel,
  destination: DESTINATIONS[0].id,
};

/** A Notion page's ID: 32 hexadecimal characters, as `ntn` takes it after `page:`. */
const NOTION_PAGE_ID = /^[0-9a-f]{32}$/i;

export function isNotionPageId(value: unknown): value is string {
  return typeof value === "string" && NOTION_PAGE_ID.test(value);
}

/** The settings a request or a queue file carries, each optional. */
export type GivenSettings = Partial<DigestSettings> & {
  /** The Notion page that holds the digests, when the destination is Notion. */
  notionFolderPage?: string;
};

const PROVIDER_OF = Object.fromEntries(
  PROVIDERS.flatMap((provider) => provider.models.map((model) => [model.id, provider.id])),
) as Record<ModelId, ProviderId>;

export function isLanguageId(value: unknown): value is LanguageId {
  return LANGUAGES.some((language) => language.id === value);
}

export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && Object.hasOwn(PROVIDER_OF, value);
}

/** The provider whose tool runs the model. */
export function providerOf(model: ModelId): ProviderId {
  return PROVIDER_OF[model];
}

/**
 * The settings a request or a queue file gives, each of them optional, since every one written before the popup has
 * none. One that is given must be known: the model and the folder page become command-line arguments.
 */
export function readSettings(given: Record<keyof DigestSettings | "notionFolderPage", unknown>): Parsed<GivenSettings> {
  const { language, model, destination, notionFolderPage } = given;
  if (language !== undefined && !isLanguageId(language)) {
    return { parsed: false, reason: `language is not one of ${LANGUAGES.map((known) => known.id).join(", ")}` };
  }
  if (model !== undefined && !isModelId(model)) {
    return { parsed: false, reason: "model is not one of the models the popup offers" };
  }
  if (destination !== undefined && !DESTINATIONS.some((known) => known.id === destination)) {
    return { parsed: false, reason: `destination is not one of ${DESTINATIONS.map((known) => known.id).join(", ")}` };
  }
  if (notionFolderPage !== undefined && !isNotionPageId(notionFolderPage)) {
    return { parsed: false, reason: "notionFolderPage is not 32 hexadecimal characters" };
  }
  return {
    parsed: true,
    value: {
      ...(language === undefined ? {} : { language }),
      ...(model === undefined ? {} : { model }),
      ...(destination === undefined ? {} : { destination: destination as DestinationId }),
      ...(notionFolderPage === undefined ? {} : { notionFolderPage }),
    },
  };
}
