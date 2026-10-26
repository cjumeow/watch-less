// The watch page's video menu, the ⋯ under the player, and which video it is for. The selectors were checked against
// YouTube's live markup; the fixture page e2e/pages/watch.html copies it.

import { parseRequest, type RequestMessage } from "@yt-digest/shared";

/**
 * The ⋯ under the player that opens the playing video's menu, after Like and Share. Matched by structure, not by its
 * label, which changes with YouTube's language.
 */
export const WATCH_MENU_OPENER = "ytd-watch-metadata ytd-menu-renderer yt-icon-button#button > button";

/** The video whose menu the ⋯ `opener` opens on the page at `url`, read when it is pressed. */
export function videoOfWatchMenu(opener: Element, url: URL): RequestMessage | undefined {
  if (url.pathname !== "/watch") return undefined;
  return videoOfWatchPage(opener.ownerDocument, url);
}

/**
 * The video playing on the watch page at `url`: its ID from the URL, and its title from the page's metadata. Moving
 * to another video, YouTube changes the URL about a second before the metadata, so a title is read only from metadata
 * that names the same video; until then the video is requested with no title.
 */
export function videoOfWatchPage(root: ParentNode, url: URL): RequestMessage | undefined {
  const videoId = url.searchParams.get("v");
  const metadata = root.querySelector("ytd-watch-metadata");
  const shown = metadata !== null && metadata.getAttribute("video-id") === videoId;
  const request = parseRequest({
    videoId,
    title: shown ? (metadata.querySelector("h1")?.textContent.trim() ?? "") : "",
  });
  return request.parsed ? request.value : undefined;
}
