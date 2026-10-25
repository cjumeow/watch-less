# Request a digest from the watch page

While watching a video, the developer decides it deserves a digest and presses the note button in the player's
control bar, without leaving the video. The button answers as the thumbnail's does: a green check when the request is
in the queue, or a short message above it saying why it is not.

## Sub-features

- `appears`: the button is the first of the player's right-hand controls on `https://www.youtube.com/watch?v=...`,
  and the only button on the page: the related videos' cards get none.
- `controls`: the button shows and hides with YouTube's controls, and keeps them showing while its check or message
  does.
- `rerender`: controls YouTube renders anew get the button again.
- `queued`: a press, with the pointer or with Space or Enter, sends the video playing, `{ videoId, title }`, to the native host and shows the green check.
- `messages`: `yt-digest is not installed`, `yt-digest did not respond` (after 5 seconds) or `yt-digest failed`,
  above the button, in a `role="status"` element.
- `navigation`: after YouTube moves to another video without a page load, the button requests the new video.
- `theater-fullscreen`: in theater mode and fullscreen the button stays in the controls and requests the video.

## How to get to it (user POV)

- The note button at the left end of the player's right-hand controls, before autoplay, subtitles and settings, on
  a watch page, in the default view, theater mode and fullscreen.

## Driving it

Preconditions: Node.js 24 and `npm install`; Playwright's Chromium installed with `npx playwright install chromium`.
Never the developer's Chrome: the tests launch Playwright's own Chromium with a temporary profile.

1. **Build the extension.** `npm run build`. `extension/dist/` holds `manifest.json`, `content.js`,
   `background.js` and `page.css`.
2. **Run the end-to-end tests.** `npx playwright test -c e2e request-digest-watch-page`, or `npm run test:e2e` for
   every feature. The tests serve the made-up watch page `e2e/pages/watch.html` at
   `https://www.youtube.com/watch?v=watchVideo1`, with `e2e/pages/watch.js` playing YouTube's part (hiding the
   controls, theater mode, fullscreen, moving to the related video), and a fake native host as in
   [request-digest-from-thumbnail.md](request-digest-from-thumbnail.md). The run ends with `11 passed`.
3. **Look at the button.** The tests save screenshots under `artifacts/e2e/<test>/`: the button in the controls
   (`watch-page.png`), the check (`watch-check.png`), in theater mode (`watch-theater.png`) and fullscreen
   (`watch-fullscreen.png`), and each message (`watch-failed.png`, `watch-no-response.png`,
   `watch-not-installed.png`).
4. **Proof:** the test run's output with every test passing, the screenshots, and the messages the fake host
   received: `{ "videoId": "watchVideo1", "title": "Example lecture: why bridges hum in the wind" }`, and after moving
   to the related video `{ "videoId": "watchVideo2", "title": "Made-up tour of a lighthouse that never existed" }`.

## Gotchas

- The fixture copies the live player as it was when the button was built: `#movie_player` inside `ytd-watch-flexy`,
  the controls in `.ytp-right-controls > .ytp-right-controls-left`, and `ytp-autohide` on the player hiding
  `.ytp-chrome-bottom` with its opacity. Theater mode and fullscreen move the player into
  `#player-full-bleed-container` and keep the same controls. When the live button goes missing, re-check
  `PLAYER_CONTROLS` in `extension/src/watch-page.ts` against the live site, in Playwright's Chromium with a temporary
  profile; a signed-out watch page is enough.
- Moving to another video, YouTube changes the URL about a second before `ytd-watch-metadata`'s `video-id` and title.
  A press in that second sends the new video with no title, which the unit tests in `watch-page.test.ts` cover; the
  navigation test waits for the title before pressing.
- The controls hide with a 0.1-second fade, so a test that checks they stay during the feedback waits past the fade;
  checking at once passes even without the rule that keeps them.
- YouTube's player takes Space anywhere on the page as pause, so the button stops Space and Enter from reaching it;
  `e2e/pages/watch.js` copies that shortcut, and the Space test fails without the guard.
