// The button on one card, as confirmed in docs/prototypes/button.html: a grey note icon that turns into a green check
// for 1.5 seconds when the request is queued, or shows one message for 3 seconds when it is not.
//
// A content script has no custom element registry, so the button is a plain element with a custom tag name and a
// closed shadow root, not a defined custom element.

import { type ButtonResult } from "./button-result.js";

const NOTE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 1.5V8h4.5M8 12h8M8 15.5h8M8 19h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK_MS = 1500;
const MESSAGE_MS = 3000;

/** The button's tag. Where it sits and when it shows is in page.css, outside the shadow root. */
export const BUTTON_TAG = "yt-digest-button";

/** Set on the button while its check or message shows, so it stays visible after the pointer leaves the card. */
const ACTIVE = "data-active";

/**
 * Set on the button while it has the keyboard's focus, so it shows. Not after a click, which leaves the focus there
 * too: the shadow host never matches :focus-visible, so page.css cannot tell the two apart without it.
 */
const FOCUSED = "data-focused";

// Pointer events that would otherwise reach the card and open the video or start its preview.
const KEPT_FROM_YOUTUBE = ["click", "auxclick", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup"];

// One stylesheet for every button on the page: parsed once, adopted by each shadow root.
let sheet: CSSStyleSheet | undefined;

function buttonSheet(): CSSStyleSheet {
  if (sheet === undefined) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :host { display: flex; align-items: center; gap: 6px; }
      button {
        all: unset; box-sizing: border-box; width: 32px; height: 32px; border-radius: 50%;
        display: grid; place-items: center; cursor: pointer;
        background: rgb(0 0 0 / 60%); color: #d0d0d0;
      }
      button:hover { background: rgb(0 0 0 / 80%); color: #fff; }
      button:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 2px; }
      button[aria-disabled="true"] { cursor: default; opacity: 0.6; }
      button.done { color: #2ba640; background: rgb(0 0 0 / 80%); }
      svg { width: 20px; height: 20px; }
      .message {
        padding: 4px 8px; border-radius: 4px; background: rgb(0 0 0 / 80%); color: #fff;
        font: 500 12px/1.4 Roboto, Arial, sans-serif; white-space: nowrap;
      }
      /* Empty but still in the accessibility tree, so a screen reader announces the text when it is set. */
      .message:empty {
        position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%);
      }
    `);
  }
  return sheet;
}

/** Makes a button that calls `request` on each press and shows its result. */
export function createButton(request: () => Promise<ButtonResult>): HTMLElement {
  const host = document.createElement(BUTTON_TAG);
  const root = host.attachShadow({ mode: "closed" });
  root.adoptedStyleSheets = [buttonSheet()];

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Request a digest");
  const message = document.createElement("span");
  message.className = "message";
  message.setAttribute("role", "status");
  root.append(button, message);

  let feedback: ReturnType<typeof setTimeout> | undefined;
  const showNote = () => {
    button.innerHTML = NOTE_ICON;
    button.classList.remove("done");
    message.textContent = "";
  };
  showNote();

  for (const type of KEPT_FROM_YOUTUBE)
    host.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  button.addEventListener("focus", () => {
    host.toggleAttribute(FOCUSED, button.matches(":focus-visible"));
  });
  button.addEventListener("blur", () => {
    host.removeAttribute(FOCUSED);
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (button.getAttribute("aria-disabled") === "true") return;
    // A new press ends the previous press's feedback at once.
    clearTimeout(feedback);
    showNote();
    host.setAttribute(ACTIVE, "");
    button.setAttribute("aria-disabled", "true");
    void request().then((result) => {
      button.removeAttribute("aria-disabled");
      if (result.ok) {
        button.innerHTML = CHECK_ICON;
        button.classList.add("done");
      } else {
        message.textContent = result.message;
      }
      feedback = setTimeout(
        () => {
          showNote();
          host.removeAttribute(ACTIVE);
        },
        result.ok ? CHECK_MS : MESSAGE_MS,
      );
    });
  });

  return host;
}
