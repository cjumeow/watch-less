# Changelog

All notable changes to yt-digest are in this file, in the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are no releases: yt-digest is installed from a
checkout, so every entry is under Unreleased.

## [Unreleased]

### Added

- Digests can be saved to Notion as well as Heptabase, with Notion's official CLI `ntn` signed in once with
  `ntn login`: choose Save to in the popup, and optionally a folder page for the new pages (empty: your Private
  section). Heptabase stays the default. `sh scripts/setup.sh` checks for `ntn` and offers the sign-in.
- Set up yt-digest with one command, `sh scripts/setup.sh`: it installs the missing tools after asking once,
  signs you in to Claude Code or Codex CLI, and installs yt-digest.
- Digests can be written by OpenAI's models (GPT-6 Luna, Sol, 6.1 Sol and Astra) through Codex CLI and your
  ChatGPT plan, never an API key. Pick one in the popup. Codex's usage limit is not recognised yet, so a digest
  that meets it fails instead of waiting.
- A toolbar popup picks the language digests are written in and the model that writes them, saved as soon as it is
  chosen and used by the next request. The extension now asks for Chrome's `storage` permission, and has a toolbar icon.

### Changed

- Request a digest with Summarize, first in a video's ⋮ menu (home, search, Watch Later) or the ⋯ under the player;
  the result shows in a toast with the video's title. The note buttons on thumbnails and in the player are gone.

- Digests are written in English by Haiku 5.5, faster and lighter on the subscription, in three sections:
  Conclusion, Main arguments (one per three minutes) and References. The assessment and web searches are gone,
  and the header links the channel. The prompt can write in other languages, ready for choosing one.

- A digest's third section is now 參考資料 (references): what the video mentions, such as papers, repositories and
  tools, each with its moment and a link from the description or a search, or 找不到連結, without sponsor links.

### Fixed

- A video without subtitles is transcribed with Whisper again instead of failing with "No transcript available".
- Summarize shows in every video's menu when signed out of YouTube, not only in the first one opened after loading
  the page.
- A digest's references are each just the name as a link, or the name and the moment it is named, without a
  description or a bare address.
- A main argument's time range, or a moment, that the model writes without its link now links to that moment
  in the video.
- The Summarize item shows in the watch page's ⋯ menu too: YouTube draws that ⋯ with newer markup than the
  extension looked for.
- The Summarize item's text and icon follow YouTube's theme instead of showing black on the dark menu, and the item
  is also in the menus of the related videos beside the player.
- The note button no longer jumps while YouTube plays a video's inline preview: the preview's button sits exactly
  where the card's button is, though the preview is larger than the thumbnail.
- The note button stays usable while YouTube plays a video's inline preview: the preview has the same button, which
  requests the video it plays.
- Install and update yt-digest with `npm run install-local`, which installs the last commit outside the checkout, so
  Chrome can start the native host and switching branches no longer changes the yt-digest in use.

### Added

- A note button on the watch page, first of the player's right-hand controls, which requests the video playing, also
  in theater mode and fullscreen and after moving to another video.

- The worker writes digests with an isolated Opus model, rejects incomplete answers, and postpones requests when a
  known Claude usage limit is reached; model runs stop after ten minutes.

- The worker checks a video before processing it, then uses its original-language subtitles, automatic captions or
  local Whisper transcription; rolling automatic captions no longer repeat displayed lines.

- Digests delivered to Heptabase with an embedded video, the `yt-digest` tag and the Created by AI mark; the worker
  starts Heptabase once and retries when it cannot connect.

- A worker that takes the queue oldest first, skips a video already digested, writes each digest under a header with
  the video's link and details, and sends a `Digest ready` or `Digest failed` notification; its steps come next.
- The digest prompt: a digest in Traditional Chinese with a conclusion, the main arguments linked to their moment in
  the video, the video's sources, and an assessment whose added claims carry a source or say 未經查證 (unverified).
- A native host that puts each requested video in the queue folder and answers the extension.
- A note button on the thumbnails of the home page, search results and Watch Later, shown on hover, that requests a
  digest of the video; it turns into a green check when the request is queued, or says why it was not.
