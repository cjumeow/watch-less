// @vitest-environment jsdom
// The fixture pages are the ones the end-to-end tests serve, so both check the same copy of YouTube's markup.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { CARD_MENU_OPENER, videoOfCardMenu } from "./cards.js";

const HOME = "https://www.youtube.com/";
const SEARCH = "https://www.youtube.com/results?search_query=example";
const WATCH_LATER = "https://www.youtube.com/playlist?list=WL";

function loadPage(name: string) {
  const html = readFileSync(join(import.meta.dirname, `../../e2e/pages/${name}.html`), "utf8");
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, "text/html").documentElement.innerHTML;
}

/** The video of each ⋮ on the page that opens a card's menu, in document order. */
function videosOfOpeners(url: string) {
  return [...document.querySelectorAll(CARD_MENU_OPENER)].map((opener) => videoOfCardMenu(opener, new URL(url)));
}

beforeEach(() => {
  document.documentElement.innerHTML = "";
});

describe("videoOfCardMenu", () => {
  test("reads each video on the home page, and no video from a mix's menu", () => {
    loadPage("home");
    expect(videosOfOpeners(HOME)).toEqual([
      { videoId: "homeVideo01", title: "A made-up talk about sourdough starters" },
      { videoId: "homeVideo02", title: "Example lecture: why bridges hum in the wind" },
      undefined,
      { videoId: "homeVideo03", title: "Placeholder review of a fictional laptop" },
    ]);
  });

  test("reads each video in search results, and no video from a Short's", () => {
    loadPage("search");
    expect(videosOfOpeners(SEARCH)).toEqual([
      { videoId: "searchVid01", title: "Sample interview with an imaginary economist" },
      undefined,
      { videoId: "searchVid02", title: "Example explainer on how tides work" },
    ]);
  });

  test("reads each video in Watch Later", () => {
    loadPage("watch-later");
    expect(videosOfOpeners(WATCH_LATER)).toEqual([
      { videoId: "laterVideo1", title: "Made-up guide to repotting houseplants" },
      { videoId: "laterVideo2", title: "An imaginary history of the paperclip" },
    ]);
  });

  test("a Short's ⋮ on the home page is not a card's menu", () => {
    loadPage("home");
    const short = document.querySelector(".shortsLockupViewModelHostOutsideMetadataMenu button");
    expect(short?.matches(CARD_MENU_OPENER)).toBe(false);
  });

  test.each([
    ["another playlist", "watch-later", "https://www.youtube.com/playlist?list=PLexampleList"],
    ["a channel's videos", "home", "https://www.youtube.com/@ExampleChannel/videos"],
    ["the watch page", "watch", "https://www.youtube.com/watch?v=watchVideo1"],
  ])("reads no video on %s", (_case, page, url) => {
    loadPage(page);
    const videos = videosOfOpeners(url);
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.every((video) => video === undefined)).toBe(true);
  });
});
