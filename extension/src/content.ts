// The content script, on every YouTube page: it puts the Summarize item first in YouTube's video menu when the menu is
// an ordinary video's, and shows the result of choosing it in a toast.
//
// YouTube opens one shared menu for the whole page, in ytd-popup-container, and fills it anew each time; the menu holds
// no video. So the script remembers which ⋮ was pressed, before YouTube's own handlers run, and adds the item when the
// menu's list appears.

import { BUTTON_MESSAGES, type RequestMessage } from "@yt-digest/shared";
import { type ButtonResult } from "./button-result.js";
import { CARD_MENU_OPENER, videoOfCardMenu } from "./cards.js";
import { createItem, ITEM_TAG, MENU_LISTS } from "./menu-item.js";
import { showToast } from "./toast.js";
import { videoOfWatchMenu, WATCH_MENU_OPENER } from "./watch-page.js";

const FAILED: ButtonResult = { ok: false, message: BUTTON_MESSAGES.failed };

/** Where YouTube puts its shared menu. It may not exist yet when the script runs. */
const POPUP_CONTAINER = "ytd-popup-container";

/** Sends the video to the service worker, which asks the native host. */
async function request(video: RequestMessage): Promise<ButtonResult> {
  try {
    return await chrome.runtime.sendMessage<RequestMessage, ButtonResult>(video);
  } catch {
    // The extension was reloaded or removed since the page loaded.
    return FAILED;
  }
}

/** The video of the menu opening now, from the last press; none when that press opened no ordinary video's menu. */
let opening: RequestMessage | undefined;

/** The video whose menu the pressed element opens, if it is the ⋮ of a card with the item or the ⋯ under the player. */
function videoOfMenuOpenedBy(target: Element): RequestMessage | undefined {
  const url = new URL(location.href);
  const cardOpener = target.closest(CARD_MENU_OPENER);
  if (cardOpener !== null) return videoOfCardMenu(cardOpener, url);
  const watchOpener = target.closest(WATCH_MENU_OPENER);
  return watchOpener === null ? undefined : videoOfWatchMenu(watchOpener, url);
}

/**
 * Remembers each press, in the capture phase, before YouTube opens a menu for it: a pointer's pointerdown, or the click
 * a key makes on a focused button, which has no pointerdown. A press outside the menu also takes away the item from the
 * last menu, since YouTube may reuse that menu's list for the next one, which may not be a video's.
 */
function remember(event: Event) {
  const target = event.target;
  if (!(target instanceof Element) || target.closest(ITEM_TAG) !== null) return;
  // A pointer's click follows its pointerdown, which was already remembered.
  if (event instanceof MouseEvent && event.type === "click" && event.detail !== 0) return;
  opening = videoOfMenuOpenedBy(target);
  if (target.closest(POPUP_CONTAINER) === null) {
    for (const item of document.querySelectorAll(ITEM_TAG)) item.remove();
  }
}
for (const type of ["pointerdown", "click"])
  document.addEventListener(type, remember, { capture: true, passive: true });

/**
 * A key that chooses one of YouTube's items or closes the menu ends it too, so that a menu YouTube opens next without a
 * press, such as the sheet of Save to playlist, gets no item.
 */
document.addEventListener(
  "keydown",
  (event) => {
    if (event.target instanceof Element && event.target.closest(ITEM_TAG) !== null) return;
    if (["Enter", " ", "Escape"].includes(event.key)) opening = undefined;
  },
  { capture: true, passive: true },
);

/** Puts the item first in each of the menu's lists that lacks it, for the video of the menu opening. */
function fill(container: Element) {
  const video = opening;
  if (video === undefined) return;
  for (const list of container.querySelectorAll(MENU_LISTS)) {
    if (list.querySelector(`:scope > ${ITEM_TAG}`) !== null) continue;
    list.prepend(
      createItem(() => {
        void request(video).then((result) => {
          showToast(result, video.title);
        });
      }),
    );
  }
}

function watch(container: Element) {
  new MutationObserver(() => {
    fill(container);
  }).observe(container, { childList: true, subtree: true });
  fill(container);
}

const container = document.querySelector(POPUP_CONTAINER);
if (container !== null) {
  watch(container);
} else {
  const waiting = new MutationObserver(() => {
    const found = document.querySelector(POPUP_CONTAINER);
    if (found === null) return;
    waiting.disconnect();
    watch(found);
  });
  waiting.observe(document.documentElement, { childList: true, subtree: true });
}
