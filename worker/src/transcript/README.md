# Getting a transcript

`createTranscriptStep()` implements the worker's existing `TranscriptStep` interface. It reads metadata without
media downloads, checks eligibility, then returns a checked video whose `getTranscript()` obtains timed lines.
The model step remains separate; this adapter never judges the video's claims.

## Runtime tools

The worker's `PATH` must contain `yt-dlp`, Node.js 24, `ffmpeg`, and `mlx_whisper`. Whisper uses
`mlx-community/whisper-large-v3-turbo` on this Mac and may download its model on first use. Its explicit `transcribe`
task keeps the audio's language; the model step later writes the digest in Traditional Chinese.

Every yt-dlp call ignores local config, so a developer's download paths, subtitle preferences or postprocessors do
not change worker behavior. Node is explicitly enabled as yt-dlp's JavaScript runtime. Commands receive argument
arrays, never interpolated shell text. Metadata reads and caption downloads have a two-minute timeout, audio
conversion five minutes, and Whisper thirty minutes.

## Source selection

Use the original `-orig` automatic-caption marker, an original audio format's language, or the metadata language.
Prefer manual subtitles in that language, including regional variants, then original automatic captions. Only VTT
tracks with HTTPS URLs and no `tlang` translation parameter are eligible. When the original language is unknown,
use audio rather than guessing from the list of subtitle languages.

A private metadata snapshot exposes only the selected caption track to `yt-dlp --load-info-json`; no second video
lookup can substitute a translated track. Failed, empty or malformed caption files fall through to the next source.
If none works, download audio and read Whisper's timed JSON segments. Malformed or empty Whisper output fails with
`No transcript available`. All temporary metadata, subtitles and audio are removed on success or failure.

VTT parsing strips display markup, decodes entities and validates timestamps. For automatic captions only,
identical suffix/prefix lines in overlapping or contiguous cues are emitted once. Repetitions after a gap and all
manual-subtitle repetitions are retained. This is text normalization, not a judgment about the content.

## Verification

Run `npx vitest run worker/src/transcript/`. The three seams are those confirmed in issue #12: VTT parsing,
metadata eligibility/source selection, and the complete step with fake executables first on `PATH`.
The tests use invented videos and never contact YouTube, run a real model, or touch the real queue.

For build verification, bundle `worker/src/transcript/index.ts` from a clean snapshot of a commit using esbuild
with `--bundle --platform=node --format=esm --target=node24`, and drive its exported `createTranscriptStep()`
with fake commands on `PATH`. Record each returned source, refusal reason, command sequence and cleanup result
under `artifacts/feat/video-transcript/`. A live YouTube/Whisper check remains part of the later whole-flow check.

Tool contracts were checked against yt-dlp 2026.10.21, its
[YouTube extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py), and the
[MLX Whisper CLI](https://github.com/ml-explore/mlx-examples/blob/main/whisper/mlx_whisper/cli.py).
