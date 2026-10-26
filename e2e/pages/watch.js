// Plays YouTube's part on the fixture watch page, as the live site behaves: a related video opens without a page
// load, the URL first and the video-id and title about a second later. Not YouTube's code, only the behaviour the
// extension meets.

/* global document, history, setTimeout, URL -- this script runs in the page. */

const METADATA_DELAY_MS = 1000;

const flexy = document.querySelector("ytd-watch-flexy");

document.querySelector("#secondary").addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="/watch?v="]');
  if (link === null) return;
  event.preventDefault();
  const href = link.getAttribute("href");
  const title = link.closest("yt-lockup-view-model").querySelector("h3").textContent.trim();
  history.pushState({}, "", href);
  setTimeout(() => {
    const videoId = new URL(href, document.baseURI).searchParams.get("v");
    flexy.setAttribute("video-id", videoId);
    document.querySelector("ytd-watch-metadata").setAttribute("video-id", videoId);
    document.querySelector("ytd-watch-metadata h1 yt-formatted-string").textContent = title;
  }, METADATA_DELAY_MS);
});
