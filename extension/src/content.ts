// The content script, on every YouTube page: YouTube changes pages without reloading, so it decides on each scan
// whether the current page gets buttons.

import { BUTTON_MESSAGES, type RequestMessage } from "@yt-digest/shared";
import { type ButtonResult } from "./button-result.js";
import { findCards, HANDLED, thumbnailOf, videoOf } from "./cards.js";
import { BUTTON_TAG, createButton } from "./digest-button.js";

const FAILED: ButtonResult = { ok: false, message: BUTTON_MESSAGES.failed };

/** Sends the card's current video to the service worker, which asks the native host. */
async function request(card: Element): Promise<ButtonResult> {
  const video = videoOf(card);
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
    thumbnail?.before(createButton(() => request(card)));
  }
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
