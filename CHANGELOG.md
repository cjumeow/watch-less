# Changelog

All notable changes to yt-digest are in this file, in the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are no releases: yt-digest is installed from a
checkout, so every entry is under Unreleased.

## [Unreleased]

### Fixed

- The note button stays usable while YouTube plays a video's inline preview: the preview has the same button, which
  requests the video it plays.
- Install and update yt-digest with `npm run install-local`, which installs the last commit outside the checkout, so
  Chrome can start the native host and switching branches no longer changes the yt-digest in use.

### Added

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
