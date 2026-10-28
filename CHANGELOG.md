# Changelog

All notable changes to yt-digest are in this file, in the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with versions that follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). yt-digest is installed from a checkout; a release is a
tag on `main` whose section here becomes the GitHub release.

## [Unreleased]

## [0.1.0] - 2026-10-28

The first release: summarize a YouTube video into a digest in Heptabase or Notion without opening it.

### Added

- Request a digest with Summarize, first in a video's ⋮ menu (home, search, Watch Later, the related videos beside
  the player) or the ⋯ under the player; the result shows in a toast with the video's title, in YouTube's theme.
- A toolbar popup picks the language digests are written in, the model that writes them and where they are saved,
  each kept as soon as it is chosen and used by the next request.
- Digests are written by Claude through Claude Code and your Claude subscription (Haiku 5.5 by default), or by
  OpenAI's models through Codex CLI and your ChatGPT plan, never an API key.
- A digest has a header linking the video and its channel, then three sections: Conclusion, Main arguments (one per
  three minutes, each linked to its moment in the video) and References, the papers, repositories and tools the video
  mentions, each linked from the description or a search, without sponsor links.
- The transcript comes from the video's original-language subtitles, its automatic captions or, without either, a
  local Whisper transcription; rolling automatic captions do not repeat lines.
- Digests are saved to Heptabase with the video embedded, the `yt-digest` tag and the Created by AI mark, or to
  Notion through its CLI `ntn`, optionally under a folder page you pick.
- Requests are queued and digested oldest first, a video already digested is skipped, and a `Digest ready` or
  `Digest failed` notification follows each one. A request that meets a known Claude usage limit waits for it to
  reset; Codex's limit is not recognised yet, so it fails instead.
- Set up yt-digest with one command, `sh scripts/setup.sh`: it installs the missing tools after asking once, signs
  you in to Claude Code or Codex CLI, offers Notion's sign-in, and installs yt-digest outside the checkout with
  `npm run install-local`.

[unreleased]: https://github.com/cjumeow/watch-less/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cjumeow/watch-less/releases/tag/v0.1.0
