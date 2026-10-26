import { DEFAULT_SETTINGS } from "@yt-digest/shared";
import { describe, expect, test } from "vitest";
import { savedSettings } from "./saved-settings.js";

describe("savedSettings", () => {
  test("is the default when nothing is stored", () => {
    expect(savedSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  test("is what is stored", () => {
    expect(savedSettings({ language: "ja", model: "claude-opus-5-5" })).toEqual({
      language: "ja",
      model: "claude-opus-5-5",
    });
  });

  test("falls back to the default for each value that is missing or unknown, on its own", () => {
    expect(savedSettings({ language: "ja", model: "a-removed-model" })).toEqual({
      language: "ja",
      model: DEFAULT_SETTINGS.model,
    });
    expect(savedSettings({ language: 7, model: "claude-sonnet-5-5" })).toEqual({
      language: DEFAULT_SETTINGS.language,
      model: "claude-sonnet-5-5",
    });
  });
});
