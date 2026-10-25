// The content script, on every YouTube page: YouTube changes pages without reloading, so it decides on each scan
// whether the current page gets buttons.

import { BUTTON_MESSAGES, type RequestMessage } from "@yt-digest/shared";
import { type ButtonResult } from "./button-result.js";
import { findCards, HANDLED, pageOf, PREVIEW, thumbnailOf, videoOf, videoOfPreview } from "./cards.js";
import { BUTTON_TAG, createButton } from "./digest-button.js";

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
    const button = preview.querySelector(`:scope > ${BUTTON_TAG}`);
    if (pageOf(new URL(location.href)) === undefined) {
      button?.remove();
    } else if (button === null) {
      preview.append(createButton(() => request(videoOfPreview(preview, document))));
    }
  },
  { capture: true, passive: true },
);

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
