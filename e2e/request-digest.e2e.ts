// Requesting a digest from a thumbnail: .claude/skills/verify/features/request-digest-from-thumbnail.md, one test per
// journey there.

import { type Locator, type Page } from "@playwright/test";
import { buttonStates, expect, test } from "./fixtures.js";

const HOME = "https://www.youtube.com/";
const SEARCH = "https://www.youtube.com/results?search_query=example";
const WATCH_LATER = "https://www.youtube.com/playlist?list=WL";

/** The card of the video with this ID, on any of the fixture pages. */
function card(page: Page, videoId: string): Locator {
  return page
    .locator("yt-lockup-view-model, ytd-video-renderer")
    .filter({ has: page.locator(`h3 a[href*="v=${videoId}"]`) });
}

/** Presses the button on a card, on its icon, as a pointer does. */
async function press(cardLocator: Locator) {
  await cardLocator.hover();
  await cardLocator.locator("yt-digest-button").click({ position: { x: 16, y: 16 } });
}

/** The state of the button on the nth card that has one. */
async function stateOf(page: Page, index = 0) {
  const states = await buttonStates(page);
  return states[index];
}

/** The video ID of every card that has a button, in document order. */
function videosWithButtons(page: Page) {
  return page
    .locator("yt-lockup-view-model, ytd-video-renderer")
    .filter({ has: page.locator("yt-digest-button") })
    .evaluateAll((cards) =>
      cards.map(
        (c) =>
          c
            .querySelector("h3 a")
            ?.getAttribute("href")
            ?.match(/v=([\w-]{11})/)?.[1],
      ),
    );
}

test.describe("where the button appears", () => {
  for (const [name, url, videos] of [
    ["the home page", HOME, ["homeVideo01", "homeVideo02", "homeVideo03"]],
    ["search results", SEARCH, ["searchVid01", "searchVid02"]],
    ["Watch Later", WATCH_LATER, ["laterVideo1", "laterVideo2"]],
  ] as const) {
    test(`every video on ${name} has a button, and no Short or mix does`, async ({ page }, testInfo) => {
      await page.goto(url);
      await expect.poll(() => videosWithButtons(page)).toEqual(videos);
      expect(await page.locator("ytm-shorts-lockup-view-model-v2 yt-digest-button").count()).toBe(0);
      expect(await page.locator("yt-digest-button").count()).toBe(videos.length);

      const states = await buttonStates(page);
      expect(states.map((s) => s.label)).toEqual(videos.map(() => "Request a digest"));

      // At the thumbnail's top-left corner, 8 pixels in, on every card.
      for (const videoId of videos) {
        const thumbnail = await card(page, videoId)
          .locator("a.ytLockupViewModelContentImage, a#thumbnail")
          .boundingBox();
        const button = await card(page, videoId).locator("yt-digest-button").boundingBox();
        expect([button?.x, button?.y]).toEqual([(thumbnail?.x ?? 0) + 8, (thumbnail?.y ?? 0) + 8]);
      }

      await card(page, videos[0]).hover();
      await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(" ", "-")}.png`) });
    });
  }

  test("another playlist has no button", async ({ page }) => {
    await page.goto("https://www.youtube.com/playlist?list=PLexampleList");
    // Give the content script time to scan, which it does at once on a page that is already rendered.
    await page.waitForTimeout(500);
    expect(await page.locator("yt-digest-button").count()).toBe(0);
  });

  test("the button shows only while the pointer is over its card", async ({ page }) => {
    await page.goto(HOME);
    const button = card(page, "homeVideo02").locator("yt-digest-button");
    await expect(button).toHaveCSS("opacity", "0");
    await card(page, "homeVideo02").hover();
    await expect(button).toHaveCSS("opacity", "1");
    await page.mouse.move(1, 1);
    await expect(button).toHaveCSS("opacity", "0");
  });

  test("the button shows while it has the keyboard focus", async ({ page }) => {
    await page.goto(SEARCH);
    const button = card(page, "searchVid01").locator("yt-digest-button");
    await expect(button).toHaveCSS("opacity", "0");
    // The first card's button comes after nothing but the page itself, so Tab reaches it before its title link.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("YT-DIGEST-BUTTON");
    await expect(button).toHaveCSS("opacity", "1");
  });

  test("a card YouTube adds later gets a button", async ({ page }) => {
    await page.goto(SEARCH);
    await expect.poll(() => videosWithButtons(page)).toEqual(["searchVid01", "searchVid02"]);
    // As YouTube appends results when the page scrolls: a copy of the last card, for another made-up video.
    await page.evaluate(() => {
      const last = [...document.querySelectorAll("ytd-video-renderer")].at(-1);
      if (last === undefined) throw new Error("No card to copy");
      const copy = document.createElement("ytd-video-renderer");
      copy.innerHTML = last.innerHTML.replaceAll("searchVid02", "searchVid03").replaceAll("Example explainer", "Copy");
      // Without what the extension added to the card it copies: a new card from YouTube has neither.
      copy.querySelector("yt-digest-button")?.remove();
      copy.querySelector("[data-yt-digest]")?.removeAttribute("data-yt-digest");
      last.after(copy);
    });
    await expect.poll(() => videosWithButtons(page)).toEqual(["searchVid01", "searchVid02", "searchVid03"]);
  });
});

test.describe("pressing the button", () => {
  test("sends the video to the host and shows the check for about 1.5 seconds", async ({ page, host }, testInfo) => {
    await host.answer({ reply: { ok: true } });
    await page.goto(HOME);
    // YouTube opens a video from a click that reaches its card; this stands in for that.
    await page.evaluate(() => {
      document.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("yt-lockup-view-model") !== null) {
          document.body.dataset.cardOpened = "true";
        }
      });
    });

    const pressedAt = Date.now();
    await press(card(page, "homeVideo02"));
    await expect.poll(async () => (await stateOf(page, 1))?.icon).toBe("check");
    await page.screenshot({ path: testInfo.outputPath("check.png") });

    expect(await host.requests()).toEqual([
      { videoId: "homeVideo02", title: "Example lecture: why bridges hum in the wind" },
    ]);
    expect(await page.evaluate(() => document.body.dataset.cardOpened)).toBeUndefined();
    expect(page.url()).toBe(HOME);

    // The check keeps the button visible after the pointer leaves the card.
    await page.mouse.move(1, 1);
    await expect(card(page, "homeVideo02").locator("yt-digest-button")).toHaveCSS("opacity", "1");

    // The check starts after the reply, so it still shows a second after the press, and is gone within 3 seconds.
    await page.waitForTimeout(Math.max(0, pressedAt + 1000 - Date.now()));
    expect((await stateOf(page, 1))?.icon).toBe("check");
    await expect.poll(async () => (await stateOf(page, 1))?.icon, { timeout: 2000 }).toBe("note");
    expect(Date.now() - pressedAt).toBeLessThan(3000);
    await expect(card(page, "homeVideo02").locator("yt-digest-button")).toHaveCSS("opacity", "0");
  });

  test("is dimmed and cannot be pressed again while it waits for the host", async ({ page, host }) => {
    await host.answer("silent");
    await page.goto(WATCH_LATER);
    await press(card(page, "laterVideo1"));
    await expect.poll(async () => (await stateOf(page))?.disabled).toBe(true);
    await card(page, "laterVideo1")
      .locator("yt-digest-button")
      .click({ position: { x: 16, y: 16 } });
    await expect.poll(() => host.requests()).toHaveLength(1);
    // Still one request after a second press while waiting.
    await page.waitForTimeout(500);
    expect(await host.requests()).toHaveLength(1);
  });

  test("says the host failed when it replies with an error", async ({ page, host }, testInfo) => {
    await host.answer({ reply: { ok: false, error: "queue-unwritable" } });
    await page.goto(SEARCH);
    await press(card(page, "searchVid01"));
    await expect.poll(async () => (await stateOf(page))?.message).toBe("yt-digest failed");
    expect((await stateOf(page))?.messageRole).toBe("status");
    await page.screenshot({ path: testInfo.outputPath("failed.png") });
    expect(await host.requests()).toEqual([
      { videoId: "searchVid01", title: "Sample interview with an imaginary economist" },
    ]);
  });

  test("says the host did not respond after 5 seconds without a reply", async ({ page, host }, testInfo) => {
    await host.answer("silent");
    await page.goto(SEARCH);
    await press(card(page, "searchVid02"));
    const pressedAt = Date.now();
    await expect
      .poll(async () => (await stateOf(page, 1))?.message, { timeout: 8000 })
      .toBe("yt-digest did not respond");
    expect(Date.now() - pressedAt).toBeGreaterThan(4500);
    await page.screenshot({ path: testInfo.outputPath("no-response.png") });
  });

  test("a press during the message ends it and sends a new request", async ({ page, host }) => {
    await host.answer({ reply: { ok: false, error: "queue-unwritable" } });
    await page.goto(HOME);
    await press(card(page, "homeVideo01"));
    await expect.poll(async () => (await stateOf(page))?.message).toBe("yt-digest failed");

    await host.answer({ reply: { ok: true } });
    await card(page, "homeVideo01")
      .locator("yt-digest-button")
      .click({ position: { x: 16, y: 16 } });
    await expect.poll(async () => (await stateOf(page))?.icon).toBe("check");
    expect((await stateOf(page))?.message).toBeNull();
    expect(await host.requests()).toHaveLength(2);
  });
});

test.describe("without the native host", () => {
  test.use({ hostInstalled: false });

  test("says yt-digest is not installed, for 3 seconds", async ({ page }, testInfo) => {
    await page.goto(WATCH_LATER);
    const pressedAt = Date.now();
    await press(card(page, "laterVideo2"));
    await expect.poll(async () => (await stateOf(page, 1))?.message).toBe("yt-digest is not installed");
    await page.screenshot({ path: testInfo.outputPath("not-installed.png") });

    // The message keeps the button visible after the pointer leaves the card.
    await page.mouse.move(1, 1);
    await expect(card(page, "laterVideo2").locator("yt-digest-button")).toHaveCSS("opacity", "1");

    // The message starts after Chrome's answer, so it still shows 2.5 seconds after the press, and is gone within 5.
    await page.waitForTimeout(Math.max(0, pressedAt + 2500 - Date.now()));
    expect((await stateOf(page, 1))?.message).toBe("yt-digest is not installed");
    await expect.poll(async () => (await stateOf(page, 1))?.message, { timeout: 2500 }).toBeNull();
    expect(Date.now() - pressedAt).toBeLessThan(5000);
    expect((await stateOf(page, 1))?.icon).toBe("note");
  });
});
