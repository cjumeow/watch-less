// Requesting a digest from YouTube's video menu: .claude/skills/verify/features/request-digest-from-video-menu.md, one
// test per journey there.

import { DEFAULT_SETTINGS } from "@yt-digest/shared";
import { type Locator, type Page } from "@playwright/test";
import { expect, test } from "./fixtures.js";

const HOME = "https://www.youtube.com/";
const SEARCH = "https://www.youtube.com/results?search_query=example";
const WATCH_LATER = "https://www.youtube.com/playlist?list=WL";
const WATCH = "https://www.youtube.com/watch?v=watchVideo1";

const YOUTUBE_ITEMS = ["Add to queue", "Save to Watch later", "Save to playlist", "Share", "Report"];
const WITH_SUMMARIZE = ["Summarize", ...YOUTUBE_ITEMS];

const VIDEOS = {
  homeVideo02: { videoId: "homeVideo02", title: "Example lecture: why bridges hum in the wind" },
  searchVid01: { videoId: "searchVid01", title: "Sample interview with an imaginary economist" },
  laterVideo2: { videoId: "laterVideo2", title: "An imaginary history of the paperclip" },
  watchVideo1: { videoId: "watchVideo1", title: "Example lecture: why bridges hum in the wind" },
  watchVideo2: { videoId: "watchVideo2", title: "Made-up tour of a lighthouse that never existed" },
};

/** The ⋮ of the card of the video with this ID, on the home page, search results or Watch Later. */
function cardOpener(page: Page, videoId: string): Locator {
  return page
    .locator("yt-lockup-view-model, ytd-video-renderer")
    .filter({ has: page.locator(`h3 a[href*="v=${videoId}"]`) })
    .locator(".ytLockupMetadataViewModelMenuButton button, #menu button");
}

/** The ⋯ under the player on the watch page. */
function watchOpener(page: Page): Locator {
  return page.locator("ytd-watch-metadata #menu yt-button-shape button");
}

const DROPDOWN = "ytd-popup-container tp-yt-iron-dropdown";

/** Opens a menu with its ⋮ or ⋯, as a pointer does, and waits for YouTube's items. */
async function open(page: Page, opener: Locator) {
  await opener.click();
  await expect(page.locator(DROPDOWN)).toBeVisible();
}

/** The labels of the open menu's items, in order. */
function items(page: Page) {
  return page
    .locator(`${DROPDOWN} :is(yt-list-view-model, tp-yt-paper-listbox) > *`)
    .evaluateAll((elements) => elements.map((e) => e.textContent.trim()));
}

function summarize(page: Page): Locator {
  return page.locator(DROPDOWN).getByRole("menuitem", { name: "Summarize" });
}

function toast(page: Page): Locator {
  return page.locator("yt-digest-toast");
}

/** The toast's two lines: the result, and the video's title. */
async function toastLines(page: Page) {
  await expect(toast(page)).toBeVisible();
  // Past its fade-in, so that a screenshot shows it as it stays.
  await expect(toast(page)).toHaveCSS("opacity", "1");
  return [await toast(page).locator("strong").textContent(), await toast(page).locator(".video").textContent()];
}

const MENUS = [
  ["the home page", HOME, (page: Page) => cardOpener(page, "homeVideo02"), VIDEOS.homeVideo02],
  ["search results", SEARCH, (page: Page) => cardOpener(page, "searchVid01"), VIDEOS.searchVid01],
  ["Watch Later", WATCH_LATER, (page: Page) => cardOpener(page, "laterVideo2"), VIDEOS.laterVideo2],
  ["the watch page", WATCH, watchOpener, VIDEOS.watchVideo1],
  ["the watch page's related videos", WATCH, (page: Page) => cardOpener(page, "watchVideo2"), VIDEOS.watchVideo2],
] as const;

test.describe("where the item appears", () => {
  for (const [name, url, opener] of MENUS) {
    test(`Summarize is first in a video's menu on ${name}`, async ({ page }, testInfo) => {
      await page.goto(url);
      await open(page, opener(page));
      await expect.poll(() => items(page)).toEqual(WITH_SUMMARIZE);
      await expect(summarize(page).locator("svg")).toBeVisible();
      // In YouTube's text colour, which the menu itself does not set.
      const youTubeColor = await page
        .locator(`${DROPDOWN} :is(yt-list-item-view-model, tp-yt-paper-item)`)
        .first()
        .evaluate((element) => getComputedStyle(element).color);
      await expect(summarize(page)).toHaveCSS("color", youTubeColor);
      await summarize(page).hover();
      await page.screenshot({ path: testInfo.outputPath(`menu-${name.replaceAll(" ", "-")}.png`) });
    });
  }

  for (const [name, url, opener] of [
    [
      "a mix's menu on the home page",
      HOME,
      ".ytLockupViewModelCollectionStack2 .ytLockupMetadataViewModelMenuButton button",
    ],
    ["a Short's menu on the home page", HOME, ".shortsLockupViewModelHostOutsideMetadataMenu button"],
    ["a Short's menu in search results", SEARCH, 'ytd-video-renderer:has(a[href^="/shorts/"]) #menu button'],
    [
      "a video's menu in another playlist",
      "https://www.youtube.com/playlist?list=PLexampleList",
      "#menu button, .ytLockupMetadataViewModelMenuButton button",
    ],
  ] as const) {
    test(`${name} has no Summarize`, async ({ page }) => {
      await page.goto(url);
      await open(page, page.locator(opener).first());
      await expect.poll(() => items(page)).toEqual(YOUTUBE_ITEMS);
      // The content script adds the item when the menu's list appears; give it time to add one it should not.
      await page.waitForTimeout(300);
      expect(await items(page)).toEqual(YOUTUBE_ITEMS);
    });
  }

  test("a menu YouTube shows again unchanged, as for every card when signed out, has the item for the new video", async ({
    page,
    host,
  }) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(HOME);
    await open(page, cardOpener(page, "homeVideo01"));
    await expect.poll(() => items(page)).toEqual(WITH_SUMMARIZE);
    // A click outside closes the menu and takes its item away, so the list YouTube shows next is unchanged.
    await page.mouse.click(1, 1);
    await expect(page.locator(DROPDOWN)).toBeHidden();

    await open(page, cardOpener(page, "homeVideo02"));
    await expect.poll(() => items(page)).toEqual(WITH_SUMMARIZE);
    await summarize(page).click();
    await expect.poll(() => host.requests()).toEqual([{ ...VIDEOS.homeVideo02, ...DEFAULT_SETTINGS }]);
  });

  test("YouTube's one menu, refilled for a mix after a video and for a video after a mix, has the item only for the video", async ({
    page,
  }) => {
    await page.goto(HOME);
    await open(page, cardOpener(page, "homeVideo01"));
    await expect.poll(() => items(page)).toEqual(WITH_SUMMARIZE);
    await page.keyboard.press("Escape");
    await expect(page.locator(DROPDOWN)).toBeHidden();

    await open(page, page.locator(".ytLockupViewModelCollectionStack2 .ytLockupMetadataViewModelMenuButton button"));
    await page.waitForTimeout(300);
    expect(await items(page)).toEqual(YOUTUBE_ITEMS);

    // A click outside closes the mix's menu; the next video's menu has the item again.
    await page.mouse.click(1, 1);
    await expect(page.locator(DROPDOWN)).toBeHidden();
    await open(page, cardOpener(page, "homeVideo03"));
    await expect.poll(() => items(page)).toEqual(WITH_SUMMARIZE);
  });
});

test.describe("choosing it", () => {
  for (const [name, url, opener, video] of MENUS) {
    test(`on ${name}, requests the video, closes the menu and says Digest requested`, async ({
      page,
      host,
    }, testInfo) => {
      await host.answer({ reply: { ok: true } });
      await page.goto(url);
      await open(page, opener(page));
      await summarize(page).click();

      await expect(page.locator(DROPDOWN)).toBeHidden();
      expect(await toastLines(page)).toEqual(["Digest requested", video.title]);
      await expect(toast(page)).toHaveAttribute("role", "status");
      await page.screenshot({ path: testInfo.outputPath(`requested-${name.replaceAll(" ", "-")}.png`) });
      expect(await host.requests()).toEqual([{ ...video, ...DEFAULT_SETTINGS }]);
      // None of YouTube's own items was chosen, and the page did not change.
      expect(await page.evaluate(() => document.body.dataset.chosen)).toBeUndefined();
      expect(page.url()).toBe(url);
    });
  }

  test("with the keyboard, Enter on the focused item requests the video", async ({ page, host }) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(SEARCH);
    await open(page, cardOpener(page, "searchVid01"));
    await summarize(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(DROPDOWN)).toBeHidden();
    expect(await toastLines(page)).toEqual(["Digest requested", VIDEOS.searchVid01.title]);
    expect(await host.requests()).toEqual([{ ...VIDEOS.searchVid01, ...DEFAULT_SETTINGS }]);
  });

  test("with the keyboard only, a menu opened with Enter has the item, and Space chooses it", async ({
    page,
    host,
  }) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(HOME);
    await cardOpener(page, "homeVideo02").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(DROPDOWN)).toBeVisible();
    await expect.poll(() => items(page)).toEqual(WITH_SUMMARIZE);
    await summarize(page).focus();
    await page.keyboard.press("Space");
    await expect(page.locator(DROPDOWN)).toBeHidden();
    expect(await toastLines(page)).toEqual(["Digest requested", VIDEOS.homeVideo02.title]);
    expect(await host.requests()).toEqual([{ ...VIDEOS.homeVideo02, ...DEFAULT_SETTINGS }]);
  });

  test("the toast shows for 3 seconds at the bottom left, and a new one replaces it", async ({ page, host }) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(HOME);
    await open(page, cardOpener(page, "homeVideo01"));
    await summarize(page).click();
    await expect(toast(page)).toBeVisible();
    const shownAt = Date.now();
    // 24 pixels from the bottom-left corner of the 1100×800 window, once its slide-in ends.
    await expect
      .poll(async () => {
        const box = await toast(page).boundingBox();
        return [box?.x, (box?.y ?? 0) + (box?.height ?? 0)];
      })
      .toEqual([24, 800 - 24]);

    await host.answer({ reply: { ok: false, error: "queue-unwritable" } });
    await open(page, cardOpener(page, "homeVideo02"));
    await summarize(page).click();
    await expect(toast(page).locator("strong")).toHaveText("yt-digest failed");
    expect(await page.locator("yt-digest-toast").count()).toBe(1);
    expect(await toastLines(page)).toEqual(["yt-digest failed", VIDEOS.homeVideo02.title]);
    const replacedAt = Date.now();

    // The new toast keeps its full 3 seconds, past the moment the first one would have gone.
    await page.waitForTimeout(Math.max(0, shownAt + 3300 - Date.now()));
    await expect(toast(page)).toBeVisible();
    await expect(toast(page)).toBeHidden({ timeout: 3000 });
    expect(Date.now() - replacedAt).toBeGreaterThan(2500);
  });

  test("the toast is the inverse of the page's theme", async ({ page, host }, testInfo) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(HOME);
    await open(page, cardOpener(page, "homeVideo01"));
    await summarize(page).click();
    // YouTube's dark theme sets `dark` on <html>: the toast is light.
    await expect(toast(page)).toHaveCSS("background-color", "rgb(241, 241, 241)");

    await page.evaluate(() => {
      document.documentElement.removeAttribute("dark");
      document.body.style.background = "#fff";
      document.body.style.color = "#0f0f0f";
    });
    await open(page, cardOpener(page, "homeVideo03"));
    await summarize(page).click();
    await expect(toast(page).locator(".video")).toHaveText("Placeholder review of a fictional laptop");
    await expect(toast(page)).toHaveCSS("background-color", "rgb(15, 15, 15)");
    await expect(toast(page)).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("toast-light-theme.png") });
  });

  test("says the host failed when it replies with an error", async ({ page, host }, testInfo) => {
    await host.answer({ reply: { ok: false, error: "queue-unwritable" } });
    await page.goto(WATCH);
    await open(page, watchOpener(page));
    await summarize(page).click();
    expect(await toastLines(page)).toEqual(["yt-digest failed", VIDEOS.watchVideo1.title]);
    await page.screenshot({ path: testInfo.outputPath("failed.png") });
  });

  test("says the host did not respond after 5 seconds without a reply", async ({ page, host }, testInfo) => {
    await host.answer("silent");
    await page.goto(SEARCH);
    await open(page, cardOpener(page, "searchVid01"));
    await summarize(page).click();
    const chosenAt = Date.now();
    await expect(toast(page)).toBeVisible({ timeout: 8000 });
    expect(Date.now() - chosenAt).toBeGreaterThan(4500);
    expect(await toastLines(page)).toEqual(["yt-digest did not respond", VIDEOS.searchVid01.title]);
    await page.screenshot({ path: testInfo.outputPath("no-response.png") });
    expect(await host.requests()).toHaveLength(1);
  });

  test("after moving to another video without a page load, the ⋯ requests the new video", async ({ page, host }) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(WATCH);
    await page.locator("#secondary a.ytLockupViewModelContentImage").click();
    await expect(page).toHaveURL(/v=watchVideo2/);
    await expect(page.locator("ytd-watch-metadata h1")).toHaveText(VIDEOS.watchVideo2.title);

    await open(page, watchOpener(page));
    await summarize(page).click();
    expect(await toastLines(page)).toEqual(["Digest requested", VIDEOS.watchVideo2.title]);
    expect(await host.requests()).toEqual([{ ...VIDEOS.watchVideo2, ...DEFAULT_SETTINGS }]);
  });
});

test.describe("without the native host", () => {
  test.use({ hostInstalled: false });

  test("says yt-digest is not installed", async ({ page }, testInfo) => {
    await page.goto(WATCH_LATER);
    await open(page, cardOpener(page, "laterVideo2"));
    await summarize(page).click();
    expect(await toastLines(page)).toEqual(["yt-digest is not installed", VIDEOS.laterVideo2.title]);
    await page.screenshot({ path: testInfo.outputPath("not-installed.png") });
  });
});
