import { DEFAULT_SETTINGS } from "@yt-digest/shared";
import { describe, expect, test } from "vitest";
import { notionPageIdFrom, savedSettings } from "./saved-settings.js";

describe("savedSettings", () => {
  test("is the default when nothing is stored", () => {
    expect(savedSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  test("is what is stored", () => {
    expect(savedSettings({ language: "ja", model: "claude-opus-5-5" })).toEqual({
      language: "ja",
      model: "claude-opus-5-5",
      destination: "heptabase",
    });
  });

  test("falls back to the default for each value that is missing or unknown, on its own", () => {
    expect(savedSettings({ language: "ja", model: "a-removed-model" })).toEqual({
      language: "ja",
      model: DEFAULT_SETTINGS.model,
      destination: "heptabase",
    });
    expect(savedSettings({ language: 7, model: "claude-sonnet-5-5" })).toEqual({
      language: DEFAULT_SETTINGS.language,
      model: "claude-sonnet-5-5",
      destination: "heptabase",
    });
  });

  test("carries a Notion destination and its folder page", () => {
    const page = "0123456789abcdef0123456789abcdef";
    expect(savedSettings({ destination: "notion", notionFolderPage: page })).toEqual({
      ...DEFAULT_SETTINGS,
      destination: "notion",
      notionFolderPage: page,
    });
  });

  test("drops a destination it does not know and a folder page that is not an ID", () => {
    expect(savedSettings({ destination: "obsidian", notionFolderPage: "not-an-id" })).toEqual(DEFAULT_SETTINGS);
  });
});

describe("notionPageIdFrom", () => {
  const id = "0123456789abcdef0123456789abcdef";

  test.each([
    ["nothing", "", ""],
    ["only spaces", "   ", ""],
    ["an ID", id, id],
    ["an ID in capitals", id.toUpperCase(), id],
    ["an ID with hyphens", "01234567-89ab-cdef-0123-456789abcdef", id],
    ["a link ending in a title and an ID", `https://www.notion.so/My-Folder-${id}`, id],
    ["a link with a workspace and a query", `https://www.notion.so/team/${id}?pvs=4`, id],
  ])("reads %s", (_case, text, expected) => {
    expect(notionPageIdFrom(text)).toBe(expected);
  });

  test.each([
    ["a link to another site", `https://example.com/${id}`],
    ["a link without an ID", "https://www.notion.so/My-Folder"],
    ["a short ID", id.slice(1)],
    ["words", "my folder"],
  ])("refuses %s", (_case, text) => {
    expect(notionPageIdFrom(text)).toBeUndefined();
  });
});
