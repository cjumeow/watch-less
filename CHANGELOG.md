# Changelog

All notable changes to yt-digest are in this file, in the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are no releases: yt-digest is installed from a
checkout, so every entry is under Unreleased.

## [Unreleased]

### Added

- A worker that takes the queue oldest first, skips a video already digested, writes each digest under a header with
  the video's link and details, and sends a `Digest ready` or `Digest failed` notification; its steps come next.
- The digest prompt: a digest in Traditional Chinese with a conclusion, the main arguments linked to their moment in
  the video, the video's sources, and an assessment whose added claims carry a source or say 未經查證 (unverified).
- A native host that puts each requested video in the queue folder and answers the extension; register it with
  `native-host/install.sh <extension-id>` after `npm run build`.
