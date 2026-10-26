# Pick the digest's language and model

The developer clicks the extension's button in Chrome's toolbar and picks the language digests are written in and the
model that writes them. A choice is saved as soon as it is made, with `Saved` shown briefly, and the next request
carries it through the native host into the queue file, which the worker writes the digest from.

## Sub-features

- `defaults`: opened for the first time, the popup shows English and Haiku 5.5 (`DEFAULT_SETTINGS`), the six languages
  and the four Claude models, from `@yt-digest/shared`.
- `saved`: choosing a language or a model saves it in `chrome.storage.local` (only `language` and `model`), shows
  `Saved` for about a second, and shows the same choice when the popup opens again.
- `openai`: the OpenAI tab lists its four models, enabled; choosing one saves it and the footer names Codex CLI.
- `openai-digest`: a digest asked for an OpenAI model is written by `codex exec` (the built worker with a fake `codex`
  on a temporary queue file; a real run only with the developer's approval), and the header names the model.
- `request`: the next Summarize sends `{ videoId, title, language, model }` to the native host, and one after a change
  sends the change.
- `fallback`: a stored value that is no longer a known ID is replaced by its default in the request.
- `queue-file`: the native host copies `language` and `model` into `<videoId>.json`, and writes the file as before
  when the request has neither.

## How to get to it (user POV)

- Click yt-digest's button, Tabler's message-ai icon, at the right of Chrome's toolbar (under the puzzle-piece menu
  until it is pinned).

## Driving it

Preconditions: Node.js 24, `npm install`, Playwright's Chromium (`npx playwright install chromium`). Never the
developer's Chrome.

1. **Build.** `npm run build`; `extension/dist/` holds `popup.html`, `popup.js`, `popup.css` and `icons/`.
2. **Run the popup tests.** `npx playwright test -c e2e popup.e2e.ts`. Playwright cannot click Chrome's toolbar, so
   each test opens `chrome-extension://<id>/popup.html` as a tab 340 pixels wide, the page Chrome shows in the popup,
   and reads `chrome.storage.local` through the extension's service worker. Screenshots are under
   `artifacts/e2e/<test>/`: `popup-defaults.png`, `popup-saved.png`, `popup-openai.png`.
3. **The host.** `npx vitest run native-host` checks the queue file with and without the two fields. For the real host
   on a temporary folder, send it one framed request with `YT_DIGEST_DATA_DIR` set to a new temporary directory and
   read `queue/<videoId>.json`; never the real `claude -p`, and never the developer's data folder.
4. **Proof:** the passing run, the three screenshots, the request the fake host received
   (`{ videoId, title, language: "ja", model: "claude-sonnet-5-5" }`) and the queue file the real host wrote.

## Gotchas

- The popup opened as a tab is not the toolbar popup: Chrome's own sizing (up to 800 × 600), its closing when focus
  leaves, and the toolbar button itself are left to the developer's look after `npm run install-local`.
- The e2e fixture lets `chrome-extension:` URLs through its offline route; every other host is still blocked.
- The provider switch's radios are visually hidden, so a test clicks their label.
