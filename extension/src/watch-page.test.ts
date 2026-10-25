// @vitest-environment jsdom
// The fixture page is the one the end-to-end tests serve, so both check the same copy of YouTube's markup.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { videoOfWatchPage } from "./watch-page.js";

const WATCH = "https://www.youtube.com/watch?v=watchVideo1";

function loadPage() {
  const html = readFileSync(join(import.meta.dirname, "../../e2e/pages/watch.html"), "utf8");
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, "text/html").documentElement.innerHTML;
}

beforeEach(() => {
  loadPage();
});

describe("videoOfWatchPage", () => {
  test("reads the video playing, with its title", () => {
    expect(videoOfWatchPage(document, new URL(WATCH))).toEqual({
      videoId: "watchVideo1",
      title: "Example lecture: why bridges hum in the wind",
    });
  });

  test("reads the next video with no title until YouTube shows its title", () => {
    // YouTube changes the URL about a second before the page's video-id and title.
    expect(videoOfWatchPage(document, new URL("https://www.youtube.com/watch?v=watchVideo2"))).toEqual({
      videoId: "watchVideo2",
      title: "",
    });
  });

  test("reads no video from a URL without one", () => {
    expect(videoOfWatchPage(document, new URL("https://www.youtube.com/watch"))).toBeUndefined();
  });
});
