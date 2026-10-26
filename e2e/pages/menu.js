// Plays YouTube's part in the fixture pages' video menu, as the live site behaves: a ⋮ or ⋯ opens the page's one
// tp-yt-iron-dropdown in ytd-popup-container, filled anew on each open with the menu's own markup: a sheet of
// yt-list-item-view-model for a lockup's ⋮, and a ytd-menu-popup-renderer of ytd-menu-service-item-renderer for the
// ⋮ of a search result and the ⋯ under the player. The menu holds no video. Escape, a click outside it, or choosing
// one of YouTube's items closes it; each item closes it with its own handler, as YouTube's do. Not YouTube's code,
// only the behaviour the extension meets.

/* global document, Element, scrollX, scrollY -- this script runs in the page. */

const SHEET_OPENER =
  ".ytLockupMetadataViewModelMenuButton button, .shortsLockupViewModelHostOutsideMetadataMenu button";
const POPUP_OPENER = "ytd-menu-renderer yt-icon-button#button > button";
const ITEMS = ["Add to queue", "Save to Watch later", "Save to playlist", "Share", "Report"];

const dropdown = document.querySelector("ytd-popup-container tp-yt-iron-dropdown");
const wrapper = dropdown.querySelector("#contentWrapper");
let openedBy = null;

function sheet() {
  const element = document.createElement("yt-sheet-view-model");
  element.className = "ytSheetViewModelHost ytSheetViewModelContextual";
  element.innerHTML = `
    <yt-contextual-sheet-layout class="ytContextualSheetLayoutHost">
      <div class="ytContextualSheetLayoutContentContainer">
        <yt-list-view-model class="ytListViewModelHost" role="menu"></yt-list-view-model>
      </div>
    </yt-contextual-sheet-layout>`;
  const list = element.querySelector("yt-list-view-model");
  for (const label of ITEMS) {
    const item = document.createElement("yt-list-item-view-model");
    item.className = "yt-list-item-view-model";
    item.setAttribute("role", "menuitem");
    item.tabIndex = 0;
    item.innerHTML = `<div class="ytListItemViewModelLabel"><span class="ytListItemViewModelTitle"></span></div>`;
    item.querySelector("span").textContent = label;
    list.append(chooseOn(item, label));
  }
  return element;
}

function popup() {
  const element = document.createElement("ytd-menu-popup-renderer");
  element.className = "style-scope ytd-popup-container";
  element.setAttribute("role", "menu");
  element.innerHTML = `<tp-yt-paper-listbox id="items" class="style-scope ytd-menu-popup-renderer" role="listbox"></tp-yt-paper-listbox>`;
  const list = element.querySelector("#items");
  for (const label of ITEMS) {
    const item = document.createElement("ytd-menu-service-item-renderer");
    item.className = "style-scope ytd-menu-popup-renderer";
    item.setAttribute("role", "menuitem");
    item.innerHTML = `<tp-yt-paper-item class="style-scope ytd-menu-service-item-renderer" role="option" tabindex="0"
      ><yt-formatted-string class="style-scope ytd-menu-service-item-renderer"></yt-formatted-string
    ></tp-yt-paper-item>`;
    item.querySelector("yt-formatted-string").textContent = label;
    list.append(chooseOn(item, label));
  }
  return element;
}

/** YouTube's own item: choosing it records which one was chosen and closes the menu. */
function chooseOn(item, label) {
  item.addEventListener("click", () => {
    document.body.dataset.chosen = label;
    close();
  });
  return item;
}

function open(opener) {
  openedBy = opener;
  wrapper.replaceChildren(opener.matches(SHEET_OPENER) ? sheet() : popup());
  dropdown.style.display = "";
  dropdown.removeAttribute("aria-hidden");
  const box = opener.getBoundingClientRect();
  dropdown.style.left = `${Math.max(8, box.right + scrollX - 260)}px`;
  dropdown.style.top = `${box.bottom + scrollY + 4}px`;
}

function close() {
  dropdown.style.display = "none";
  dropdown.setAttribute("aria-hidden", "true");
  openedBy = null;
}

function isOpen() {
  return dropdown.style.display !== "none";
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const opener = target?.closest(`${SHEET_OPENER}, ${POPUP_OPENER}`) ?? null;
  if (opener !== null) {
    if (opener === openedBy) close();
    else open(opener);
  } else if (isOpen() && !dropdown.contains(target)) {
    close();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isOpen()) close();
});
