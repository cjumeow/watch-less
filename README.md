![You don't have to watch it all. A tangle of video cards resolves into one clear digest.](docs/readme-cover.png)

Another framework. Another “must-watch” talk. Another video saved for later.
Keeping up with technology can start to feel like a watch list you will never finish.

yt-digest summarizes a YouTube video for you, on your Mac, with the Claude or ChatGPT plan you already pay for, and
files the summary in Heptabase. Read it in a minute, then decide whether the full video is worth your time.

## From YouTube to Heptabase

Open a video's ⋮ menu on YouTube, on a card or under the player, and choose **Summarize**. You do not have to open
the video. A few seconds to a few minutes later, a macOS notification says the **digest** is ready: a card in
Heptabase, tagged `yt-digest`, with the video embedded at the top and three sections:

- **Conclusion:** what the video says, in two to four sentences.
- **Main arguments:** about one per three minutes of video, in the speaker's own terms, each linked to its moment.
- **References:** what the video cites, such as articles, repositories and books, each as a link.

The toolbar button picks the digest's language (English by default, or 繁體中文, 简体中文, 日本語, 한국어,
Español) and the model: Claude's, through Claude Code, or OpenAI's, through Codex CLI. The details are in
[`docs/spec.md`](docs/spec.md).

## How it runs

![The Summarize item sends the video to a native host, which queues it; a worker started by launchd fetches the transcript, has Claude or Codex write the digest, and files it in Heptabase.](docs/architecture.svg)

- **Local:** the extension, a Native Messaging host and a launchd worker, all on your Mac. There is no server.
- **Your own plan:** the worker runs `claude -p` or `codex exec`, signed in with your subscription. No API key.
- **Isolated:** a transcript is someone else's text and may try to instruct the model, so the model runs with
  nothing it can act with: no web, no shell, none of your settings, an empty folder, and nothing it writes is run.
- **Private:** what you watch stays on your Mac. The extension keeps only your language and model.
- **Once per video:** a video already summarized is skipped, and a failed one can be requested again.

This is a personal tool, not a service.

## Installing

On a Mac with Apple Silicon, Chrome and the Heptabase app, from a clone of this repository:

1. **Check the tools.** yt-digest uses Node.js 24, `yt-dlp` to read a video's subtitles, the Heptabase CLI, and
   Claude Code or Codex CLI to write the summary; `ffmpeg` and `mlx_whisper` transcribe a video without subtitles.

   ```bash
   npm install
   npm run setup
   ```

   It lists what is missing, offers to install what Homebrew and `uv` can, and says how to do the rest.

2. **Sign in and turn on Heptabase's CLI.** These need you, so the script only checks them:
   - sign in to Claude Code (`claude auth login`) or Codex CLI (`codex login`) with your Claude or ChatGPT plan, not
     an API key;
   - in the Heptabase app's settings, install the CLI and turn on the Local CLI Server.

3. **Install yt-digest.**

   ```bash
   npm run install-local
   ```

   It checks the tools again, builds the code you have checked out, copies it to
   `~/Library/Application Support/yt-digest/app/`, lets Chrome talk to it, and sets it to run in the background
   whenever you request a summary.

4. **Load the extension in Chrome,** once: in `chrome://extensions`, turn on Developer mode, press Load unpacked
   and pick `~/Library/Application Support/yt-digest/app/extension/dist` (press ⌘⇧G in the picker to type the path).

To update, pull the latest code, run `npm run install-local` again, and press Reload on yt-digest in
`chrome://extensions`.

## Development

How the repository is organized, its conventions and the skills agents use are in [`AGENTS.md`](AGENTS.md).

```bash
npm install
npm run check   # everything CI runs
```
