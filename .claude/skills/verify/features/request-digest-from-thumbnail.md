# Request a digest from a thumbnail

While browsing YouTube, the developer points at a video's card and presses the note button on its thumbnail, so the
video is queued for a digest without opening it. The button answers at once: a green check when the request is in
the queue, or a short message saying why it is not. What happens to the digest afterwards is reported by a
notification, never on the button.

## Sub-features

- `appears`: a button on every ordinary video's card on the home page, in search results and in Watch Later; none on
  Shorts, mixes, playlists, other playlists or any other page; the watch page has its own button, in
  [request-digest-from-watch-page.md](request-digest-from-watch-page.md).
- `hover`: the button shows only while the pointer is over its card, or while it has the keyboard's focus.
- `preview`: when YouTube's inline preview covers the card, the same button at the preview's top-left requests the
  video the preview plays.
- `later-cards`: cards YouTube adds as the page scrolls get a button too.
- `queued`: a press sends `{ videoId, title }` to the native host and shows the green check for about 1.5 seconds,
  without opening the video.
- `waiting`: until the host replies, the button is dimmed and a second press sends nothing.
- `messages`: `yt-digest is not installed`, `yt-digest did not respond` (after 5 seconds) or `yt-digest failed` for 3
  seconds, in a `role="status"` element.
- `press-again`: pressing during the check or a message ends it at once and sends a new request.

## How to get to it (user POV)

- The note button at the top-left of a video's thumbnail on `https://www.youtube.com/` (home).
- The same on `https://www.youtube.com/results?search_query=...` (search results).
- The same on `https://www.youtube.com/playlist?list=WL` (Watch Later).
- The note button at the top-left of YouTube's inline preview, about a second after the pointer rests on a thumbnail
  on the home page or in search results.

## Driving it

Preconditions: Node.js 24 and `npm install`; Playwright's Chromium installed with `npx playwright install chromium`.
Never the developer's Chrome: the tests launch Playwright's own Chromium with a temporary profile.

1. **Build the extension.** `npm run build`. `extension/dist/` holds `manifest.json`, `content.js`,
   `background.js` and `page.css`.
2. **Run the end-to-end tests.** `npx playwright test -c e2e request-digest.e2e.ts`, or `npm run test:e2e` for every
   feature. Each test starts Chromium with `extension/dist/` loaded, serves
   the made-up pages in `e2e/pages/` at YouTube's URLs, blocks every other request, and installs a fake native host
   (`e2e/fake-native-host.mjs`) in the temporary profile's `NativeMessagingHosts` folder. The run ends with
   `15 passed`, one test per sub-feature and page.
3. **Look at the button.** The tests save screenshots under `artifacts/e2e/<test>/`: the button on a hovered card on
   each page (`the-home-page.png`, `search-results.png`, `Watch-Later.png`), the check (`check.png`) and each message
   (`failed.png`, `no-response.png`, `not-installed.png`), and the check on the preview's button on each page
   (`preview-the-home-page.png`, `preview-search-results.png`).
4. **Proof:** the test run's output with every test passing, the screenshots of the button on the three pages and in
   each state, and the messages the fake host received, which `sends the video to the host` checks equal
   `{ "videoId": "homeVideo02", "title": "Example lecture: why bridges hum in the wind" }`.

## Gotchas

- The button's shadow root is closed, so Playwright's selectors cannot see its icon or message. The tests read them
  through the DevTools protocol (`buttonStates` in `e2e/fixtures.ts`); do not open the shadow root to make a test
  easier.
- The fixture pages copy YouTube's markup as it was when the extension was built. They prove the extension against
  that copy, not against today's YouTube: after YouTube changes its markup, the tests still pass while the live site
  has no buttons. Re-check the selectors in `extension/src/cards.ts` against the live site, in Playwright's Chromium
  with a temporary profile, when buttons go missing.
- Signed out, YouTube's home page shows no videos and Watch Later is empty, so a live check of those two pages needs
  the developer's account, which only the whole-flow check on this Mac uses.
- YouTube's inline preview, `ytd-video-preview` under `ytd-app > #video-preview`, lies outside every card and stays on
  the page when idle, with no size; while it plays, it has the class `ytdVideoPreviewActive`. It holds a watch link
  but no title, so the button takes the title from the card showing the same video. The fixture pages copy that
  structure, and `e2e/pages/preview.js` plays YouTube's part. After the preview appears, a test moves the pointer a
  little, as a resting hand does, so that Chromium sees the pointer over the preview. Whether the live preview's own
  layers sit above the button is left to the developer's check on YouTube.
- `yt-digest did not respond` takes 5 seconds to appear; a test that waits less fails for the wrong reason.
- A click leaves the keyboard focus on the button. The button shows for `:focus-visible` only, so a click does not
  keep it visible after its check ends.
