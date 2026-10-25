// Which cards on a YouTube page get a button, and which video each one shows. The selectors were checked against
// YouTube's live markup; the fixture pages in e2e/pages/ copy it.

import { parseRequest, type RequestMessage } from "@yt-digest/shared";

/** The pages with buttons, each with the element YouTube renders it in, inside `ytd-page-manager`. */
const PAGES = {
  home: 'ytd-browse[page-subtype="home"]',
  search: "ytd-search",
  watchLater: 'ytd-browse[page-subtype="playlist"]',
} as const;

/**
 * A video's card: the lockup YouTube uses on the home page and in playlists, and the older renderer of search results.
 * A Short has its own element, ytm-shorts-lockup-view-model, so it is never one of these.
 */
const CARD = "yt-lockup-view-model, ytd-video-renderer";

/** The card's thumbnail, the link around its image, which the button sits on. */
const THUMBNAIL = "a.ytLockupViewModelContentImage, ytd-thumbnail a#thumbnail";

/** A mix or a playlist is a lockup too, drawn with a stack of thumbnails. */
const COLLECTION = "yt-collection-thumbnail-view-model";

/**
 * Set on a card's thumbnail link once the card has a button, so a scan never handles it twice. On the link rather than
 * the card: when YouTube renders a card's contents anew, the new link has no mark and the card gets a new button.
 */
export const HANDLED = "data-yt-digest";

/** Which of the three pages with buttons the URL is, if any. */
export function pageOf(url: URL): keyof typeof PAGES | undefined {
  if (url.pathname === "/") return "home";
  if (url.pathname === "/results") return "search";
  if (url.pathname === "/playlist" && url.searchParams.get("list") === "WL") return "watchLater";
  return undefined;
}

/** The cards of ordinary videos on the page at `url` that have no button yet. */
export function findCards(root: ParentNode, url: URL): Element[] {
  const page = pageOf(url);
  if (page === undefined) return [];
  const container = root.querySelector(PAGES[page]);
  if (container === null) return [];
  const cards = [...container.querySelectorAll(`:is(${THUMBNAIL}):not([${HANDLED}])`)].map((link) =>
    link.closest(CARD),
  );
  return cards.filter((card): card is Element => card !== null && videoOf(card) !== undefined);
}

/** The card's thumbnail link, which the button is placed next to. */
export function thumbnailOf(card: Element): HTMLAnchorElement | null {
  return card.querySelector<HTMLAnchorElement>(THUMBNAIL);
}

/**
 * The video the card shows now, read from its thumbnail link and title. YouTube reuses a card for another video as
 * the page changes, so this is read when the button is pressed, never kept.
 */
export function videoOf(card: Element): RequestMessage | undefined {
  const link = thumbnailOf(card);
  if (link === null || card.querySelector(COLLECTION) !== null) return undefined;
  // A Short in search results is an ordinary card linking to /shorts/<id>, which has no v and so no video ID.
  return requestFor(link.getAttribute("href"), card.querySelector("h3 a")?.textContent);
}

/**
 * YouTube's inline preview: one element outside every card, which YouTube places over a card's thumbnail about a
 * second after the pointer rests on it, so the card loses its hover. Its button is added when the pointer reaches it.
 */
export const PREVIEW = "ytd-video-preview";

/**
 * The video the preview plays now, read when the button is pressed: its ID from the preview's watch link, and its
 * title from the card under `root` showing the same video, since the preview holds no title. A video whose card is
 * gone is requested with no title.
 */
export function videoOfPreview(preview: Element, root: ParentNode): RequestMessage | undefined {
  const video = requestFor(preview.querySelector('a[href*="watch?v="]')?.getAttribute("href") ?? null, "");
  if (video === undefined) return undefined;
  for (const card of root.querySelectorAll(CARD)) {
    const shown = videoOf(card);
    if (shown?.videoId === video.videoId) return shown;
  }
  return video;
}

function requestFor(href: string | null, title: string | undefined): RequestMessage | undefined {
  if (href === null) return undefined;
  const videoId = new URL(href, "https://www.youtube.com").searchParams.get("v");
  const request = parseRequest({ videoId, title: title?.trim() ?? "" });
  return request.parsed ? request.value : undefined;
}
