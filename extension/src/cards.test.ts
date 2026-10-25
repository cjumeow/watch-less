// @vitest-environment jsdom
// The fixture pages are the ones the end-to-end tests serve, so both check the same copy of YouTube's markup.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { findCards, videoOf } from "./cards.js";

function loadPage(name: string) {
  const html = readFileSync(join(import.meta.dirname, `../../e2e/pages/${name}.html`), "utf8");
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, "text/html").documentElement.innerHTML;
}

function videoIds(url: string) {
  return findCards(document, new URL(url)).map((card) => videoOf(card)?.videoId);
}

beforeEach(() => {
  document.documentElement.innerHTML = "";
});

describe("findCards", () => {
  test("finds the videos on the home page, but not its Shorts or mixes", () => {
    loadPage("home");
    expect(videoIds("https://www.youtube.com/")).toEqual(["homeVideo01", "homeVideo02", "homeVideo03"]);
  });

  test("finds the videos in search results, but not a Short shown as a result or in a shelf", () => {
    loadPage("search");
    expect(videoIds("https://www.youtube.com/results?search_query=example")).toEqual(["searchVid01", "searchVid02"]);
  });

  test("finds the videos in Watch Later", () => {
    loadPage("watch-later");
    expect(videoIds("https://www.youtube.com/playlist?list=WL")).toEqual(["laterVideo1", "laterVideo2"]);
  });

  test.each([
    ["another playlist", "watch-later", "https://www.youtube.com/playlist?list=PLexampleList"],
    ["a channel's videos", "home", "https://www.youtube.com/@ExampleChannel/videos"],
    ["the watch page", "home", "https://www.youtube.com/watch?v=homeVideo01"],
  ])("finds nothing on %s", (_case, page, url) => {
    loadPage(page);
    expect(videoIds(url)).toEqual([]);
  });

  test("skips a card that already has a button", () => {
    loadPage("search");
    document.querySelector("ytd-video-renderer a#thumbnail")?.setAttribute("data-yt-digest", "");
    expect(videoIds("https://www.youtube.com/results?search_query=example")).toEqual(["searchVid02"]);
  });
});

describe("videoOf", () => {
  test("reads no video from a mix, even on a card that was a video before", () => {
    loadPage("home");
    const mix = document.querySelector('yt-lockup-view-model:has(a[href*="list=RD"])');
    expect(mix && videoOf(mix)).toBeUndefined();
  });

  test("reads the title of the card's video", () => {
    loadPage("watch-later");
    const [card] = findCards(document, new URL("https://www.youtube.com/playlist?list=WL"));
    expect(card && videoOf(card)).toEqual({ videoId: "laterVideo1", title: "Made-up guide to repotting houseplants" });
  });
});
