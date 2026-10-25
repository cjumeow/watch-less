# yt-digest

Hover a YouTube thumbnail, press its note button, and get a neutral, evidence-backed Markdown summary of the video in
Heptabase, without opening the video. What the button does is specified in [`docs/spec.md`](docs/spec.md).

## Planned architecture

```
YouTube thumbnail hover button (Chrome extension content script, Shadow DOM)
  → service worker
  → Native Messaging host (writes a job to the queue, replies immediately)
  → queue folder (one JSON file per video)
  → worker (started by launchd WatchPaths, one at a time)
      → get transcript (yt-dlp subtitles; fallback: audio + mlx-whisper)
      → claude -p (subscription; tools restricted; prompt in prompt.md)
      → save .md → Heptabase CLI (tag #yt-digest)
      → macOS notification
```

## Summary format

- One-line conclusion
- Key points (3–7)
- Claims and evidence table, with timestamp links (`&t=754s`) and evidence strength
- Neutral assessment: what is supported, what is speculation, missing counterpoints
- Anxiety check: does this actually affect me, and do I need to act now?
- Segments worth watching in the original

## Notes

- YouTube's Watch Later list is not readable through the API, so the button replaces Watch Later.
- Personal, local use only: `claude -p` runs on my own machine with my own subscription.

## Development

How the repository is organized, its conventions and the skills agents use are in [`AGENTS.md`](AGENTS.md).

```bash
npm install
npm run check   # everything CI runs
```
