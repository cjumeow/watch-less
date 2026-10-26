// The toast that shows a request's result, as confirmed in docs/prototypes/menu-item.html: at the bottom left, the
// inverse of the page's theme, a green check and `Digest requested` or a red mark and one message, with the video's
// title on a second line, for 3 seconds. One toast for the page: a new result replaces the one showing. Its look is
// in page.css.

import { type ButtonResult } from "./button-result.js";

const TOAST_TAG = "yt-digest-toast";
const TOAST_MS = 3000;

const OK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
const FAIL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><path d="M12 16h.01"/></svg>`;

/** Set on the toast while it shows. */
const SHOWN = "data-shown";

let toast: HTMLElement | undefined;
let hide: ReturnType<typeof setTimeout> | undefined;

/** Shows the result of requesting the video titled `title`, replacing the toast showing. */
export function showToast(result: ButtonResult, title: string) {
  // One element for the page, kept between toasts, so a screen reader announces each new text in the same live region.
  if (toast?.isConnected !== true) {
    toast = document.createElement(TOAST_TAG);
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  clearTimeout(hide);
  toast.dataset.result = result.ok ? "ok" : "failed";
  toast.innerHTML = result.ok ? OK_ICON : FAIL_ICON;
  const text = document.createElement("span");
  text.className = "text";
  const message = document.createElement("strong");
  message.textContent = result.ok ? "Digest requested" : result.message;
  const video = document.createElement("span");
  video.className = "video";
  video.textContent = title;
  text.append(message, video);
  toast.append(text);

  // Restarts the slide-in when one toast replaces another: the layout read applies the hidden state first.
  toast.removeAttribute(SHOWN);
  toast.getBoundingClientRect();
  toast.setAttribute(SHOWN, "");
  const shown = toast;
  hide = setTimeout(() => {
    shown.removeAttribute(SHOWN);
  }, TOAST_MS);
}
