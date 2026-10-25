// The content script, on every YouTube page: YouTube changes pages without reloading, so it decides on each scan
// whether the current page gets buttons.

import { BUTTON_MESSAGES, type RequestMessage } from "@yt-digest/shared";
import { type ButtonResult } from "./button-result.js";
import { cardOfPreview, findCards, HANDLED, pageOf, PREVIEW, thumbnailOf, videoOf, videoOfPreview } from "./cards.js";
import { BUTTON_TAG, createButton } from "./digest-button.js";
import { ANY_PLAYER_CONTROLS, isWatchPage, PLAYER_CONTROLS, videoOfWatchPage } from "./watch-page.js";

const FAILED: ButtonResult = { ok: false, message: BUTTON_MESSAGES.failed };

/** Sends the video shown now to the service worker, which asks the native host. */
async function request(video: RequestMessage | undefined): Promise<ButtonResult> {
  if (video === undefined) return FAILED;
  try {
    return await chrome.runtime.sendMessage<RequestMessage, ButtonResult>(video);
  } catch {
    // The extension was reloaded or removed since the page loaded.
    return FAILED;
  }
}

let scannedUrl = "";

function scan(container: Element) {
  // After YouTube moves to another page, a card it reuses must not keep a button from the page before.
  if (location.href !== scannedUrl) {
    scannedUrl = location.href;
    for (const button of container.querySelectorAll(BUTTON_TAG)) button.remove();
    for (const link of container.querySelectorAll(`[${HANDLED}]`)) link.removeAttribute(HANDLED);
  }
  for (const card of findCards(container, new URL(location.href))) {
    const thumbnail = thumbnailOf(card);
    thumbnail?.setAttribute(HANDLED, "");
    thumbnail?.before(createButton(() => request(videoOf(card))));
  }
  placeInPlayer();
}

/**
 * Puts the button first in the watch page's player controls, again whenever YouTube renders them anew, and takes it
 * out of a player that has left the watch page, such as the miniplayer.
 */
function placeInPlayer() {
  const controls = isWatchPage(new URL(location.href)) ? document.querySelector(PLAYER_CONTROLS) : null;
  for (const button of document.querySelectorAll(`${ANY_PLAYER_CONTROLS} > ${BUTTON_TAG}`)) {
    if (button.parentElement !== controls) button.remove();
  }
  if (controls === null || controls.querySelector(`:scope > ${BUTTON_TAG}`)) return;
  controls.prepend(createButton(() => request(videoOfWatchPage(document, new URL(location.href))), "player"));
}

/** Scans YouTube's content area now and once per animation frame in which it changed. */
function watch(container: Element) {
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan(container);
    });
  }).observe(container, { childList: true, subtree: true });
  scan(container);
}

/**
 * Gives the preview its button when the pointer reaches it, on the pages with buttons, and takes it away on others.
 * The preview lies outside the content area, and YouTube may create it only on the first hover.
 */
document.addEventListener(
  "pointerover",
  (event) => {
    const preview = event.target instanceof Element ? event.target.closest(PREVIEW) : null;
    if (preview === null) return;
    let button = preview.querySelector<HTMLElement>(`:scope > ${BUTTON_TAG}`);
    if (pageOf(new URL(location.href)) === undefined) {
      button?.remove();
      return;
    }
    if (button === null) {
      button = createButton(() => request(videoOfPreview(preview, document)));
      preview.append(button);
    }
    // Moving between the preview's own elements, the pointer is still over the same card.
    if (!(event.relatedTarget instanceof Node && preview.contains(event.relatedTarget))) alignWithCard(button, preview);
  },
  { capture: true, passive: true },
);

/**
 * Puts the preview's button exactly over the button of the card the preview covers. The preview is larger than the
 * card's thumbnail, so at the preview's own corner the button would jump each time the pointer crossed between the
 * preview and the rest of the card.
 */
function alignWithCard(button: HTMLElement, preview: Element) {
  button.style.translate = "";
  const cardButton = cardOfPreview(preview, document)?.querySelector(BUTTON_TAG);
  if (cardButton === null || cardButton === undefined) return;
  const from = button.getBoundingClientRect();
  const to = cardButton.getBoundingClientRect();
  button.style.translate = `${String(to.left - from.left)}px ${String(to.top - from.top)}px`;
}

// YouTube's content area, which holds every page it renders. It may not exist yet when the script runs.
const CONTENT_AREA = "ytd-page-manager";

const contentArea = document.querySelector(CONTENT_AREA);
if (contentArea !== null) {
  watch(contentArea);
} else {
  const waiting = new MutationObserver(() => {
    const found = document.querySelector(CONTENT_AREA);
    if (found === null) return;
    waiting.disconnect();
    watch(found);
  });
  waiting.observe(document.documentElement, { childList: true, subtree: true });
}
