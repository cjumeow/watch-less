// The watch page's button, in the player's control bar, and which video it requests. The selectors were checked
// against YouTube's live markup; the fixture page e2e/pages/watch.html copies it.

import { parseRequest, type RequestMessage } from "@yt-digest/shared";

/**
 * The video playing on the watch page at `url`, read when the button is pressed: its ID from the URL, and its title
 * from the page's metadata. Moving to another video, YouTube changes the URL about a second before the metadata, so a
 * title is read only from metadata that names the same video; until then the video is requested with no title.
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

/** Whether the URL is a watch page, the one page whose player gets a button. */
export function isWatchPage(url: URL): boolean {
  return url.pathname === "/watch";
}

/**
 * The first group of the watch page's player's right-hand controls, which the button is put first in. Only the player
 * in ytd-watch-flexy: a miniplayer on another page, or the inline preview's player, gets none.
 */
export const PLAYER_CONTROLS = "ytd-watch-flexy #movie_player .ytp-right-controls-left";

/** The same group in any player, where a button left behind is looked for. page.css names it too. */
export const ANY_PLAYER_CONTROLS = ".ytp-right-controls-left";
