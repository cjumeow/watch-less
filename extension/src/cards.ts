// Which cards' menus get the Summarize item, and which video each one is for. The selectors were checked against
// YouTube's live markup; the fixture pages in e2e/pages/ copy it.

import { parseRequest, type RequestMessage } from "@yt-digest/shared";

/**
 * Where cards' menus get the item: three pages, and the related videos beside the player on the watch page, each
 * with the element YouTube renders the cards in, inside `ytd-page-manager`.
 */
const PAGES = {
  home: 'ytd-browse[page-subtype="home"]',
  search: "ytd-search",
  watchLater: 'ytd-browse[page-subtype="playlist"]',
  related: "ytd-watch-flexy #secondary",
} as const;

/**
 * A video's card: the lockup YouTube uses on the home page and in playlists, and the older renderer of search results.
 * A Short has its own element, ytm-shorts-lockup-view-model, so it is never one of these.
 */
const CARD = "yt-lockup-view-model, ytd-video-renderer";

/**
 * The ⋮ that opens a card's menu: a lockup's, and a search result's. Matched by structure, not by its label, which
 * differs between them ("More actions", "Action menu") and with YouTube's language.
 */
export const CARD_MENU_OPENER =
  "yt-lockup-view-model .ytLockupMetadataViewModelMenuButton button, ytd-video-renderer #menu ytd-menu-renderer yt-icon-button#button > button";

/** The card's thumbnail, the link around its image. */
const THUMBNAIL = "a.ytLockupViewModelContentImage, ytd-thumbnail a#thumbnail";

/** A mix or a playlist is a lockup too, drawn with a stack of thumbnails. */
const COLLECTION = "yt-collection-thumbnail-view-model";

/** Which of the three pages with the item the URL is, if any. */
function pageOf(url: URL): keyof typeof PAGES | undefined {
  if (url.pathname === "/") return "home";
  if (url.pathname === "/results") return "search";
  if (url.pathname === "/playlist" && url.searchParams.get("list") === "WL") return "watchLater";
  if (url.pathname === "/watch") return "related";
  return undefined;
}

/**
 * The video whose menu the card's ⋮ `opener` opens, on the page at `url`: none for a mix, a playlist or a Short, and
 * none on a page without the item. Read when the ⋮ is pressed, since YouTube reuses a card for another video.
 */
export function videoOfCardMenu(opener: Element, url: URL): RequestMessage | undefined {
  const page = pageOf(url);
  if (page === undefined || opener.closest(PAGES[page]) === null) return undefined;
  const card = opener.closest(CARD);
  return card === null ? undefined : videoOf(card);
}

/** The video the card shows, read from its thumbnail link and title. */
function videoOf(card: Element): RequestMessage | undefined {
  const link = card.querySelector(THUMBNAIL);
  if (link === null || card.querySelector(COLLECTION) !== null) return undefined;
  // A Short in search results is an ordinary card linking to /shorts/<id>, which has no v and so no video ID.
  const videoId = new URL(link.getAttribute("href") ?? "", "https://www.youtube.com").searchParams.get("v");
  const request = parseRequest({ videoId, title: card.querySelector("h3 a")?.textContent.trim() ?? "" });
  return request.parsed ? request.value : undefined;
}
