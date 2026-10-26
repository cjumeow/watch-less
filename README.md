![You don't have to watch it all. A tangle of video cards resolves into one clear digest.](docs/readme-cover.png)

Another framework. Another “must-watch” talk. Another video saved for later.
Keeping up with technology can start to feel like a watch list you will never finish.

Get a faithful **digest** before giving a video your time. Read its conclusion and main arguments, see what it cites,
and decide whether the full video is worth watching. Stay curious without treating every recommendation as homework.

## From a thumbnail to a digest

Hover a YouTube thumbnail and press its note button. The video becomes a Markdown digest in Heptabase, written in
English by default, without opening the video.

The digest includes a short conclusion, the video's main arguments in the speaker's own terms, linked to their moments,
and the references the video cites, with the description's links. The details are in [`docs/spec.md`](docs/spec.md).

**Work in progress:** the extension, native host and all worker steps are built. Installation and a real end-to-end
run still need to be verified before the complete flow is ready to use.

## How it runs

Everything runs on this Mac, using the developer's own Claude subscription. Video details, transcripts and digests
stay outside the repository. The extension remembers no watch history, and Watch Later stays untouched.

```text
YouTube thumbnail button
  → Native Messaging host → local queue
  → worker, started by launchd
      → original-language subtitles, automatic captions or local Whisper transcription
      → claude -p → digest in Heptabase → macOS notification
```

The worker uses the done folder to skip a video already digested. A failed digest can be requested again from its
thumbnail. This is a personal tool, not a hosted service.

## Installing

On this Mac, from a checkout, with Node.js 24, `yt-dlp`, `claude` and the `heptabase` CLI on `PATH`:

```bash
npm install
npm run install-local
```

It builds the last commit and installs it in `~/Library/Application Support/yt-digest/app/`, registers the native
host with Chrome and loads the worker's launchd agent. Then, once, in `chrome://extensions`, turn on Developer mode,
press Load unpacked and pick `~/Library/Application Support/yt-digest/app/extension/dist` (press ⌘⇧G in the picker to
type the path).

To update, commit and run `npm run install-local` again, then press Reload on yt-digest in `chrome://extensions`.

## Development

How the repository is organized, its conventions and the skills agents use are in [`AGENTS.md`](AGENTS.md).

```bash
npm install
npm run check   # everything CI runs
```
