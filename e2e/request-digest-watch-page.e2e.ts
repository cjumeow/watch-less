// Requesting a digest from the watch page: .claude/skills/verify/features/request-digest-from-watch-page.md, one test
// per journey there.

import { type Page } from "@playwright/test";
import { buttonStates, expect, test } from "./fixtures.js";

const WATCH = "https://www.youtube.com/watch?v=watchVideo1";
const FIRST_VIDEO = { videoId: "watchVideo1", title: "Example lecture: why bridges hum in the wind" };
const NEXT_VIDEO = { videoId: "watchVideo2", title: "Made-up tour of a lighthouse that never existed" };

/** The player's control bar, which YouTube hides by adding ytp-autohide to the player. */
const BAR = ".ytp-chrome-bottom";
const BUTTON = ".ytp-right-controls-left > yt-digest-button";

/** Moves the pointer over the player, as a hand does, so that YouTube shows its controls. */
async function showControls(page: Page) {
  const box = await page.locator("#movie_player").boundingBox();
  await page.mouse.move((box?.x ?? 0) + 200, (box?.y ?? 0) + 100);
  await page.mouse.move((box?.x ?? 0) + 210, (box?.y ?? 0) + 110);
  await expect(page.locator(BAR)).toHaveCSS("opacity", "1");
}

async function press(page: Page) {
  await showControls(page);
  await page.locator(BUTTON).click();
}

async function state(page: Page) {
  const states = await buttonStates(page);
  expect(states).toHaveLength(1);
  return states[0];
}

/** The first group of the right-hand controls, in order: the extension's button, then YouTube's by their labels. */
function rightControls(page: Page) {
  return page
    .locator(".ytp-right-controls-left > *")
    .evaluateAll((elements) => elements.map((e) => (e.localName === "button" ? e.ariaLabel : e.localName)));
}

const IN_ORDER = ["yt-digest-button", "Expand", "Autoplay is on", "Subtitles", "Settings"];

test.describe("where the button appears", () => {
  test("the button is the first of the player's right-hand controls, and the only one on the page", async ({
    page,
  }, testInfo) => {
    await page.goto(WATCH);
    await expect.poll(() => rightControls(page)).toEqual(IN_ORDER);
    // The related video in the sidebar is a card, but the watch page gives cards no button.
    expect(await page.locator("yt-digest-button").count()).toBe(1);
    expect((await state(page))?.label).toBe("Request a digest");

    await showControls(page);
    const button = await page.locator(BUTTON).boundingBox();
    const settings = await page.locator(".ytp-settings-button").boundingBox();
    expect(button?.width).toBe(40);
    expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(settings?.x ?? 0);
    expect(
      Math.abs((button?.y ?? 0) + (button?.height ?? 0) / 2 - ((settings?.y ?? 0) + (settings?.height ?? 0) / 2)),
    ).toBeLessThan(1);
    await page.screenshot({ path: testInfo.outputPath("watch-page.png") });
  });

  test("the button shows and hides with the player's controls", async ({ page }) => {
    await page.goto(WATCH);
    await expect(page.locator(BUTTON)).toHaveCount(1);
    await expect(page.locator(BAR)).toHaveCSS("opacity", "0");
    await showControls(page);
    await page.mouse.move(1, 1);
    await expect(page.locator(BAR)).toHaveCSS("opacity", "0");
  });

  test("a control bar YouTube renders anew gets the button again", async ({ page }) => {
    await page.goto(WATCH);
    await expect.poll(() => rightControls(page)).toEqual(IN_ORDER);
    await page.evaluate(() => {
      const group = document.querySelector(".ytp-right-controls-left");
      if (group === null) throw new Error("No controls");
      const fresh = group.cloneNode(true) as Element;
      // Without what the extension added: YouTube's new controls have none.
      fresh.querySelector("yt-digest-button")?.remove();
      group.replaceWith(fresh);
    });
    await expect.poll(() => rightControls(page)).toEqual(IN_ORDER);
  });
});

test.describe("pressing the button", () => {
  test("sends the video playing to the host and keeps the controls while the check shows", async ({
    page,
    host,
  }, testInfo) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(WATCH);
    await press(page);
    await expect.poll(async () => (await state(page))?.icon).toBe("check");
    await page.screenshot({ path: testInfo.outputPath("watch-check.png") });
    expect(await host.requests()).toEqual([FIRST_VIDEO]);
    expect(page.url()).toBe(WATCH);

    // The pointer leaves the player, which would hide the controls, but the check keeps them: still there after the
    // 0.1-second fade, while the check shows for 1.5 seconds.
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
    expect((await state(page))?.icon).toBe("check");
    await expect(page.locator(BAR)).toHaveCSS("opacity", "1");
    await expect.poll(async () => (await state(page))?.icon, { timeout: 2500 }).toBe("note");
    await expect(page.locator(BAR)).toHaveCSS("opacity", "0");
  });

  test("says the host failed above the button, and keeps the controls while it shows", async ({
    page,
    host,
  }, testInfo) => {
    await host.answer({ reply: { ok: false, error: "queue-unwritable" } });
    await page.goto(WATCH);
    await press(page);
    await expect.poll(async () => (await state(page))?.message).toBe("yt-digest failed");
    expect((await state(page))?.messageRole).toBe("status");
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
    await expect(page.locator(BAR)).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("watch-failed.png") });
    await expect.poll(async () => (await state(page))?.message, { timeout: 3500 }).toBeNull();
    await expect(page.locator(BAR)).toHaveCSS("opacity", "0");
  });

  test("pressing it with Space sends the request and does not pause the video", async ({ page, host }) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(WATCH);
    await expect(page.locator(BUTTON)).toHaveCount(1);
    // Tab reaches the button after the play button, the first of YouTube's controls.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.localName)).toBe("yt-digest-button");
    await page.keyboard.press("Space");
    await expect.poll(async () => (await state(page))?.icon).toBe("check");
    expect(await host.requests()).toEqual([FIRST_VIDEO]);
    await expect(page.locator("#movie_player")).toHaveClass(/playing-mode/);
  });

  test("says the host did not respond after 5 seconds without a reply", async ({ page, host }, testInfo) => {
    await host.answer("silent");
    await page.goto(WATCH);
    await press(page);
    await expect.poll(async () => (await state(page))?.disabled).toBe(true);
    await expect.poll(async () => (await state(page))?.message, { timeout: 8000 }).toBe("yt-digest did not respond");
    await page.screenshot({ path: testInfo.outputPath("watch-no-response.png") });
    expect(await host.requests()).toHaveLength(1);
  });
});

test.describe("as YouTube changes the page", () => {
  test("after moving to another video without a page load, the button requests the new video", async ({
    page,
    host,
  }) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(WATCH);
    await expect(page.locator(BUTTON)).toHaveCount(1);
    await page.locator("#secondary a.ytLockupViewModelContentImage").click();
    await expect(page).toHaveURL(/v=watchVideo2/);
    await expect(page.locator("ytd-watch-metadata h1")).toHaveText(NEXT_VIDEO.title);
    await expect.poll(() => rightControls(page)).toEqual(IN_ORDER);

    await press(page);
    await expect.poll(async () => (await state(page))?.icon).toBe("check");
    expect(await host.requests()).toEqual([NEXT_VIDEO]);
  });

  test("in theater mode the button stays in the controls and requests the video", async ({ page, host }, testInfo) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(WATCH);
    await showControls(page);
    await page.locator(".ytp-size-button").click();
    await expect(page.locator("#player-full-bleed-container #movie_player")).toHaveCount(1);
    await expect.poll(() => rightControls(page)).toEqual(IN_ORDER);

    await press(page);
    await expect.poll(async () => (await state(page))?.icon).toBe("check");
    await page.screenshot({ path: testInfo.outputPath("watch-theater.png") });
    expect(await host.requests()).toEqual([FIRST_VIDEO]);
  });

  test("in fullscreen the button stays in the controls and requests the video", async ({ page, host }, testInfo) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(WATCH);
    await showControls(page);
    await page.locator(".ytp-fullscreen-button").click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.localName)).toBe("html");
    await expect(page.locator("#player-full-bleed-container #movie_player")).toHaveCount(1);
    await expect.poll(() => rightControls(page)).toEqual(IN_ORDER);

    await press(page);
    await expect.poll(async () => (await state(page))?.icon).toBe("check");
    await page.screenshot({ path: testInfo.outputPath("watch-fullscreen.png") });
    expect(await host.requests()).toEqual([FIRST_VIDEO]);
  });
});

test.describe("without the native host", () => {
  test.use({ hostInstalled: false });

  test("says yt-digest is not installed", async ({ page }, testInfo) => {
    await page.goto(WATCH);
    await press(page);
    await expect.poll(async () => (await state(page))?.message).toBe("yt-digest is not installed");
    await page.screenshot({ path: testInfo.outputPath("watch-not-installed.png") });
  });
});
