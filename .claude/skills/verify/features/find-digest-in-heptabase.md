# Find a digest in Heptabase

A finished digest becomes a Heptabase note with its title, an embedded video, the `yt-digest` tag and the Created by
AI mark. The destination adapter is built; the full journey waits for the transcript and model steps.

## Sub-features

- `delivery`: create a note from the digest, then tag that note `yt-digest`.
- `startup`: when the CLI cannot connect, start Heptabase once and retry only the failed command.
- `failure`: report a delivery reason if creation, tagging, startup or the retry fails.

## How to get to it (user POV)

Request a digest from the YouTube button. The worker delivers it after the model finishes. This complete entry point
is not yet built; the adapter can be driven independently without touching real notes.

## Driving it

Preconditions: Node.js 24 and `npm install`, in a clean checkout of the commit under verification.

1. **Build**: run `npm run build`.
2. **Drive the destination**: run `npx vitest run worker/src/destination/heptabase.test.ts`. A fake `heptabase` first
   on `PATH` records commands and captures the content file. Tests assert creation before tagging, the embedded video,
   no opt-out of the AI mark, startup followed by a retry, bounded failures and temporary-file cleanup.
3. **Proof**: save the complete test output under `artifacts/feat/heptabase-destination/` and quote the result in
   the pull request. Expected command sequences are `note create → tag add` and
   `note create → start → note create → tag add`; an unavailable retry stops after the second `note create`.

## Gotchas

- Fake CLI tests prove the adapter contract, not the real application's rendering or the whole worker journey.
- Run the real Heptabase delivery only with the developer's agreement; read the created note back independently and
  trash the test note afterwards unless they want to keep it.
- A tag failure can leave an untagged note; it must fail delivery, not create another note during the retry.
- The CLI's connection error also covers disabled CLI access; one startup attempt does not guarantee delivery.
