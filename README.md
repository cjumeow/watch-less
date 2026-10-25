# yt-digest

Hover a YouTube thumbnail, press its note button, and get a neutral, evidence-backed Markdown summary of the video in
Heptabase, without opening the video. What it does is specified in [`docs/spec.md`](docs/spec.md).

## Architecture

```
YouTube thumbnail hover button (Chrome extension content script, Shadow DOM)
  → service worker
  → Native Messaging host (writes the request to the queue, replies immediately)
  → queue folder (one JSON file per video)
  → worker (started by launchd, one at a time)
      → get transcript (yt-dlp subtitles; fallback: audio + mlx-whisper)
      → claude -p (subscription; tools restricted; prompt in prompt/digest.md)
      → Heptabase CLI (tag yt-digest) → done folder
      → macOS notification
```

## The digest

A short conclusion, the video's main arguments with their time ranges, the sources it cites, and an assessment of
what is worth learning and what is exaggerated, with sources for every claim the assessment adds. The details are in
[`docs/spec.md`](docs/spec.md).

## Notes

- YouTube's Watch Later list is not readable through the API, so the button replaces Watch Later.
- Personal, local use only: `claude -p` runs on my own machine with my own subscription.

## Development

How the repository is organized, its conventions and the skills agents use are in [`AGENTS.md`](AGENTS.md).

```bash
npm install
npm run check   # everything CI runs
```
