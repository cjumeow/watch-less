# Changelog

All notable changes to yt-digest are in this file, in the format of
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are no releases: yt-digest is installed from a
checkout, so every entry is under Unreleased.

## [Unreleased]

### Added

- A worker that takes the queue oldest first, skips a video already digested, writes each digest under a header with
  the video's link and details, and sends a `Digest ready` or `Digest failed` notification; its steps come next.
