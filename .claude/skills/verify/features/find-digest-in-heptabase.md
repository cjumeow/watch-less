# Find a digest in Heptabase

A finished digest becomes a Heptabase note with its title, an embedded video, the `yt-digest` tag and the Created by
AI mark. All worker adapters are built. Their command contracts are checked with fake executables; the installed
whole flow still needs a real run with the developer's agreement.

## Sub-features

- `transcript`: use original-language subtitles, then automatic captions, then local Whisper transcription.
- `eligibility`: refuse live, upcoming, private, members-only, age-restricted and over-one-hour videos with a reason.
- `model`: give the isolated model only the prompt, title, video link and timed transcript; require all four sections.
- `usage-limit`: leave a known usage-limit request queued without a notification; timeouts and other errors fail.
- `delivery`: create a note from the digest, then tag that note `yt-digest`.
- `startup`: when the CLI cannot connect, start Heptabase once and retry only the failed command.
- `failure`: report a delivery reason if creation, tagging, startup or the retry fails.

## How to get to it (user POV)

Request a digest from the YouTube button. The worker delivers it after the model finishes. The installed journey is
not yet proven; each adapter can be driven independently without touching real notes or spending the subscription.

## Driving it

Preconditions: Node.js 24 and `npm install`, in a clean checkout of the commit under verification.

1. **Build**: run `npm run build`.
2. **Drive the destination**: run `npx vitest run worker/src/destination/heptabase.test.ts`. A fake `heptabase` first
   on `PATH` records commands and captures the content file. Tests assert creation before tagging, the embedded video,
   no opt-out of the AI mark, startup followed by a retry, bounded failures and temporary-file cleanup.
3. **Drive the transcript step**: run `npx vitest run worker/src/transcript/`. Fake `yt-dlp` and `mlx_whisper` commands
   exercise each source, refusal reasons, fallback, malformed output and temporary-file cleanup.
4. **Drive the model step**: run `npx vitest run worker/src/model/`. A fake `claude` records its flags, environment,
   initially empty working folder, prompt and stdin. Tests cover output parsing, usage limits, failures, ten-minute
   termination, output bounds and cleanup. No real model is called.
5. **Proof**: save the complete test output under `artifacts/feat/heptabase-destination/` and quote the result in
   the pull request. Expected command sequences are `note create → tag add` and
   `note create → start → note create → tag add`; an unavailable retry stops after the second `note create`.

## Gotchas

- Fake CLI tests prove the adapter contract, not the real application's rendering or the whole worker journey.
- Run the real Heptabase delivery only with the developer's agreement; read the created note back independently and
  trash the test note afterwards unless they want to keep it.
- A tag failure can leave an untagged note; it must fail delivery, not create another note during the retry.
- The CLI's connection error also covers disabled CLI access; one startup attempt does not guarantee delivery.
