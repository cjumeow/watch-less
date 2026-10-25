// Plays YouTube's part on the fixture watch page, as the live site behaves: the player hides its control bar, adding
// ytp-autohide, when the pointer leaves it or rests for a while, and shows it again when the pointer moves over it;
// theater mode and fullscreen move the player into #player-full-bleed-container, keeping its controls; a related
// video opens without a page load, the URL first and the video-id and title about a second later; Space anywhere on
// the page pauses or plays the video. Not YouTube's code, only the behaviour the extension meets.

/* global document, history, setTimeout, clearTimeout, URL, KeyboardEvent -- this script runs in the page. */

const AUTOHIDE_MS = 3000;
const METADATA_DELAY_MS = 1000;

const flexy = document.querySelector("ytd-watch-flexy");
const player = document.querySelector("#movie_player");
const playerContainer = document.querySelector("#player-container");
let idle;

function showControls() {
  player.classList.remove("ytp-autohide");
  clearTimeout(idle);
  idle = setTimeout(hideControls, AUTOHIDE_MS);
}

function hideControls() {
  clearTimeout(idle);
  player.classList.add("ytp-autohide");
}

player.classList.add("ytp-autohide");
player.addEventListener("pointermove", showControls);
player.addEventListener("pointerleave", hideControls);

/** Moves the player to the full-width container for theater mode and fullscreen, or back under the video's column. */
function placePlayer() {
  const wide = flexy.hasAttribute("theater") || flexy.hasAttribute("fullscreen");
  const parent = document.querySelector(wide ? "#player-full-bleed-container" : "#player-container-inner");
  if (playerContainer.parentElement !== parent) parent.append(playerContainer);
}

document.querySelector(".ytp-size-button").addEventListener("click", () => {
  flexy.toggleAttribute("theater");
  placePlayer();
});

document.querySelector(".ytp-fullscreen-button").addEventListener("click", () => {
  if (document.fullscreenElement === null) void document.documentElement.requestFullscreen();
  else void document.exitFullscreen();
});

document.addEventListener("fullscreenchange", () => {
  const fullscreen = document.fullscreenElement !== null;
  flexy.toggleAttribute("fullscreen", fullscreen);
  player.classList.toggle("ytp-fullscreen", fullscreen);
  placePlayer();
});

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

document.addEventListener("keydown", (event) => {
  if (!(event instanceof KeyboardEvent) || event.key !== " ") return;
  event.preventDefault();
  player.classList.toggle("playing-mode");
  player.classList.toggle("paused-mode");
});
