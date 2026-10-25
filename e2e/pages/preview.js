// Plays YouTube's part in the fixture pages' inline preview: about a second after the pointer rests on a video's
// thumbnail, the page's one ytd-video-preview plays that video, laid over the thumbnail, so the card loses
// its hover; it goes idle, with no size, when the pointer leaves it. Not YouTube's code, only the behaviour the extension meets.

/* global document, Element, setTimeout, clearTimeout, scrollX, scrollY -- this script runs in the page. */

const PREVIEW_DELAY_MS = 1000;
const THUMBNAIL = "a.ytLockupViewModelContentImage, ytd-thumbnail a#thumbnail";

const preview = document.querySelector("ytd-video-preview");
const container = preview.closest(".ytdVideoPreviewLoaderVideoPreviewContainer");
const PLAYING = ["ytdVideoPreviewActive", "ytdVideoPreviewPlaying"];
let timer;

document.addEventListener("pointerover", (event) => {
  const thumbnail = event.target instanceof Element ? event.target.closest(THUMBNAIL) : null;
  clearTimeout(timer);
  if (thumbnail === null || !thumbnail.getAttribute("href")?.includes("watch?v=")) return;
  timer = setTimeout(() => show(thumbnail), PREVIEW_DELAY_MS);
});

function show(thumbnail) {
  preview.querySelector("a").setAttribute("href", thumbnail.getAttribute("href"));
  const box = thumbnail.getBoundingClientRect();
  container.style.left = `${box.left + scrollX}px`;
  container.style.top = `${box.top + scrollY}px`;
  preview.style.width = `${box.width}px`;
  preview.classList.add(...PLAYING);
}

preview.addEventListener("pointerleave", () => {
  preview.classList.remove(...PLAYING);
  preview.style.width = "";
});
