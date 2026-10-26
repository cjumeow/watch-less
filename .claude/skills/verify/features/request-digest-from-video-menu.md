# Request a digest from the video menu

While browsing YouTube or watching a video, the developer opens a video's menu, the ⋮ of its card or the ⋯ under the
player, and chooses Summarize, so the video is queued for a digest without opening it. A toast at the bottom left
answers at once: `Digest requested`, or a short message saying why the request was not queued, with the video's
title. What happens to the digest afterwards is reported by a notification, never in the toast.

## Sub-features

- `appears`: Summarize is the first item in the menu of every ordinary video's card on the home page, in search
  results and in Watch Later, and in the ⋯ menu under the player on the watch page.
- `not-elsewhere`: none in the menu of a mix, a Short (on the home page or as a search result), a video in another
  playlist, or a related video on the watch page.
- `shared-menu`: YouTube's one menu, refilled for each ⋮, has the item for a video's menu after a mix's and none for
  a mix's after a video's.
- `requested`: choosing it, with the pointer or Enter, closes the menu without choosing any of YouTube's items, sends
  `{ videoId, title }` to the native host, and shows a green check and `Digest requested` with the title.
- `messages`: a red mark and `yt-digest is not installed`, `yt-digest did not respond` (after 5 seconds) or
  `yt-digest failed`, with the title.
- `toast`: at the bottom left, 24 pixels in, `role="status"`, for 3 seconds; a new toast replaces the one showing and
  keeps its own 3 seconds; light on YouTube's dark theme (`<html dark>`) and dark on its light theme.
- `keyboard`: a menu opened with Enter on its ⋮ has the item, and Space on the focused item chooses it.
- `navigation`: after YouTube moves to another video without a page load, the ⋯ requests the new video.

## How to get to it (user POV)

- Summarize in the ⋮ menu of a video's card on `https://www.youtube.com/` (home).
- The same on `https://www.youtube.com/results?search_query=...` (search results).
- The same on `https://www.youtube.com/playlist?list=WL` (Watch Later).
- Summarize in the ⋯ menu under the player, after Like and Share, on `https://www.youtube.com/watch?v=...`.

## Driving it

Preconditions: Node.js 24 and `npm install`; Playwright's Chromium installed with `npx playwright install chromium`.
Never the developer's Chrome: the tests launch Playwright's own Chromium with a temporary profile.

1. **Build the extension.** `npm run build`. `extension/dist/` holds `manifest.json`, `content.js`,
   `background.js` and `page.css`.
2. **Run the end-to-end tests.** `npx playwright test -c e2e request-digest.e2e.ts`, or `npm run test:e2e` for every
   feature. Each test starts Chromium with `extension/dist/` loaded, serves the made-up pages in `e2e/pages/` at
   YouTube's URLs, blocks every other request, and installs a fake native host (`e2e/fake-native-host.mjs`) in the
   temporary profile's `NativeMessagingHosts` folder. `e2e/pages/menu.js` plays YouTube's shared menu, and
   `e2e/pages/watch.js` the move to a related video. The run ends with `22 passed`.
3. **Look at the menu and the toast.** The tests save screenshots under `artifacts/e2e/<test>/`: the open menu with
   Summarize first on each page (`menu-the-home-page.png`, `menu-search-results.png`, `menu-Watch-Later.png`,
   `menu-the-watch-page.png`), `Digest requested` after choosing it on each page (`requested-*.png`), each message
   (`failed.png`, `no-response.png`, `not-installed.png`), and the toast on a light page (`toast-light-theme.png`).
4. **Proof:** the test run's output with every test passing, the screenshots, and the messages the fake host
   received, which the `choosing it` tests check equal, for example,
   `{ "videoId": "homeVideo02", "title": "Example lecture: why bridges hum in the wind" }` on the home page and
   `{ "videoId": "watchVideo2", "title": "Made-up tour of a lighthouse that never existed" }` after moving to the
   related video.

## Gotchas

- The fixture pages and `menu.js` copy YouTube's markup and its menu's behaviour as they were when the item was
  built (checked on 2026-10-26). They prove the extension against that copy, not against today's YouTube: after
  YouTube changes its markup, the tests still pass while the live menus have no Summarize. Re-check the selectors in
  `extension/src/cards.ts`, `watch-page.ts` and `menu-item.ts` against the live site, in Playwright's Chromium with a
  temporary profile, when the item goes missing.
- The fake menu closes on Escape, a click outside it, or one of its own items, each with its own handler, so a test
  that sees the menu close after choosing Summarize proves the extension closed it. The live menu's reaction to the
  Escape the extension dispatches is left to the developer's check on YouTube.
- The item is added when the menu's list appears, a moment after the press; a test that checks a menu has no item
  waits a little first, or it passes before the item could have been added.
- The toast fades in for 0.15 seconds; the tests wait for full opacity before a screenshot, and measure its place
  once it stops moving.
- `yt-digest did not respond` takes 5 seconds to appear; a test that waits less fails for the wrong reason.
- Signed out, YouTube's home page shows no videos and Watch Later is empty, so a live check of those two pages needs
  the developer's account, which only the whole-flow check on this Mac uses.
