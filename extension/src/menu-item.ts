// The Summarize item, as confirmed in docs/prototypes/menu-item.html: Tabler's message-ai icon in currentColor and the
// word Summarize, first in YouTube's video menu. Where it sits and how it looks is in page.css.

/** The item's tag: a plain element with a custom name, since a content script has no custom element registry. */
export const ITEM_TAG = "yt-digest-menu-item";

/**
 * The lists of YouTube's shared video menu that the item is put first in: the sheet a lockup's ⋮ opens, and the popup
 * of a search result's ⋮ and of the ⋯ under the player. Both are filled anew inside `ytd-popup-container`.
 */
export const MENU_LISTS =
  'yt-sheet-view-model yt-list-view-model[role="menu"], ytd-menu-popup-renderer tp-yt-paper-listbox#items';

// Tabler's message-ai (MIT licence, https://tabler.io/icons).
const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 9h8"/><path d="M8 13h3.5"/><path d="M9.994 19.804l-1.994 1.196v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v4"/><path d="M14 21v-4a2 2 0 1 1 4 0v4"/><path d="M14 19h4"/><path d="M21 15v6"/></svg>`;

// Pointer events that would otherwise reach YouTube's menu, which treats a press on one of its children as choosing
// one of its own items.
const KEPT_FROM_YOUTUBE = ["click", "mousedown", "mouseup", "pointerdown", "pointerup"];

// The keys that choose the item.
const CHOOSE_KEYS = [" ", "Enter"];

/** Makes the item, which closes YouTube's menu and calls `choose` when it is chosen with the pointer or a key. */
export function createItem(choose: () => void): HTMLElement {
  const item = document.createElement(ITEM_TAG);
  item.setAttribute("role", "menuitem");
  item.tabIndex = 0;
  item.innerHTML = ICON;
  const label = document.createElement("span");
  label.textContent = "Summarize";
  item.append(label);

  const chosen = () => {
    closeMenu(item);
    choose();
  };
  for (const type of KEPT_FROM_YOUTUBE)
    item.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  item.addEventListener("click", chosen);
  item.addEventListener("keydown", (event) => {
    if (!CHOOSE_KEYS.includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    chosen();
  });
  return item;
}

/**
 * Closes YouTube's menu as Escape does. The menu's own close method belongs to YouTube's scripts, which a content
 * script cannot call, but its keydown listener hears an event the content script dispatches.
 */
function closeMenu(item: HTMLElement) {
  item.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, composed: true }));
}
