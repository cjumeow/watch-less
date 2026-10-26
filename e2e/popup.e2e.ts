// Choosing the digest's language and model in the toolbar popup: .claude/skills/verify/features/pick-language-and-model.md,
// one test per journey there. Playwright cannot click Chrome's toolbar, so the popup page opens as a tab of the
// extension, which is the page Chrome shows in the popup.

import { DEFAULT_SETTINGS } from "@yt-digest/shared";
import { type BrowserContext, type Page } from "@playwright/test";
import { EXTENSION_ID, expect, test } from "./fixtures.js";

const POPUP = `chrome-extension://${EXTENSION_ID}/popup.html`;
const WATCH = "https://www.youtube.com/watch?v=watchVideo1";
const TITLE = "Example lecture: why bridges hum in the wind";

// e2e/ does not load the types of `chrome`, which exists only inside the extension's service worker.
interface WorkerChrome {
  storage: { local: { get(keys: null): Promise<Record<string, unknown>>; set(items: object): Promise<void> } };
}

/** The extension's `chrome.storage.local`, reached through its service worker. */
async function storage(context: BrowserContext) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  return {
    get: () =>
      worker.evaluate(() => (globalThis as unknown as { chrome: WorkerChrome }).chrome.storage.local.get(null)),
    set: (items: object) =>
      worker.evaluate(
        (value) => (globalThis as unknown as { chrome: WorkerChrome }).chrome.storage.local.set(value),
        items,
      ),
  };
}

async function openPopup(context: BrowserContext): Promise<Page> {
  const popup = await context.newPage();
  // The size Chrome gives it, which is the width of the page's body.
  await popup.setViewportSize({ width: 340, height: 600 });
  await popup.goto(POPUP);
  await expect(popup.locator("#language")).toBeVisible();
  return popup;
}

async function summarizeWatchedVideo(page: Page) {
  await page.goto(WATCH);
  await page.locator("ytd-watch-metadata #menu yt-button-shape button").click();
  await page.locator("ytd-popup-container tp-yt-iron-dropdown").getByRole("menuitem", { name: "Summarize" }).click();
  await expect(page.locator("yt-digest-toast strong")).toHaveText("Digest requested");
}

test("opened for the first time, it shows the defaults and offers every language and Claude model", async ({
  context,
}, testInfo) => {
  const popup = await openPopup(context);
  await expect(popup.locator("#language")).toHaveValue(DEFAULT_SETTINGS.language);
  expect(await popup.locator("#language option").allTextContents()).toEqual([
    "English",
    "繁體中文",
    "简体中文",
    "日本語",
    "한국어",
    "Español",
  ]);
  await expect(popup.locator("#models input:checked")).toHaveValue(DEFAULT_SETTINGS.model);
  expect(await popup.locator("#models .name").allTextContents()).toEqual([
    "Haiku 5.5Default",
    "Sonnet 5.5",
    "Opus 5.5",
    "Fable 5.1",
  ]);
  await expect(popup.locator("#models input:disabled")).toHaveCount(0);
  await expect(popup.locator("#note")).toBeHidden();
  await popup.screenshot({ path: testInfo.outputPath("popup-defaults.png") });
});

test("a choice is saved as soon as it is made, says Saved, and is shown again when the popup reopens", async ({
  context,
}, testInfo) => {
  const popup = await openPopup(context);
  await popup.locator("#language").selectOption("zh-Hant");
  await expect(popup.locator("#saved")).toHaveText("Saved");
  await popup.getByLabel(/Opus 5.5/).check();
  await expect(popup.locator("#saved")).toHaveText("Saved");
  await popup.screenshot({ path: testInfo.outputPath("popup-saved.png") });
  await expect(popup.locator("#saved")).toHaveText("", { timeout: 3000 });

  expect(await (await storage(context)).get()).toEqual({
    language: "zh-Hant",
    model: "claude-opus-5-5",
  });

  await popup.close();
  const reopened = await openPopup(context);
  await expect(reopened.locator("#language")).toHaveValue("zh-Hant");
  await expect(reopened.locator("#models input:checked")).toHaveValue("claude-opus-5-5");
});

test("OpenAI's models are disabled, with a line saying they are not supported yet, and nothing is saved", async ({
  context,
}, testInfo) => {
  const popup = await openPopup(context);
  await popup.locator("#providers label", { hasText: "OpenAI" }).click();
  expect(await popup.locator("#models .name").allTextContents()).toEqual([
    "GPT-6 LunaDefault",
    "GPT-6 Sol",
    "GPT-6.1 Sol",
    "GPT-6 Astra",
  ]);
  await expect(popup.locator("#models input:disabled")).toHaveCount(4);
  await expect(popup.locator("#note")).toHaveText("OpenAI models are not supported yet.");
  await popup.screenshot({ path: testInfo.outputPath("popup-openai.png") });

  await popup.locator("#providers label", { hasText: "Claude" }).click();
  await expect(popup.locator("#models input:checked")).toHaveValue(DEFAULT_SETTINGS.model);
  await expect(popup.locator("#saved")).toHaveText("");
});

test("the next Summarize sends the chosen language and model, and the one after a change sends the change", async ({
  context,
  page,
  host,
}) => {
  await host.answer({ reply: { ok: true } });
  const popup = await openPopup(context);
  await popup.locator("#language").selectOption("ja");
  await popup.getByLabel(/Sonnet 5.5/).check();
  await expect(popup.locator("#saved")).toHaveText("Saved");

  await summarizeWatchedVideo(page);
  expect(await host.requests()).toEqual([
    { videoId: "watchVideo1", title: TITLE, language: "ja", model: "claude-sonnet-5-5" },
  ]);

  await popup.locator("#language").selectOption("es");
  await expect(popup.locator("#saved")).toHaveText("Saved");
  await summarizeWatchedVideo(page);
  expect(await host.requests()).toEqual([
    { videoId: "watchVideo1", title: TITLE, language: "ja", model: "claude-sonnet-5-5" },
    { videoId: "watchVideo1", title: TITLE, language: "es", model: "claude-sonnet-5-5" },
  ]);
});

test("a saved setting that no longer parses falls back to the default in the request", async ({
  context,
  page,
  host,
}) => {
  await host.answer({ reply: { ok: true } });
  await (await storage(context)).set({ language: "ja", model: "a-model-that-was-removed" });

  await summarizeWatchedVideo(page);
  expect(await host.requests()).toEqual([
    { videoId: "watchVideo1", title: TITLE, language: "ja", model: DEFAULT_SETTINGS.model },
  ]);
});
