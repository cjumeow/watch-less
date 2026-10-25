# yt-digest spec

What the first version of yt-digest does. The terms are defined in [`GLOSSARY.md`](../GLOSSARY.md). A request
travels from the button through the native host into the queue, and the worker turns it into a digest, delivers it
to the destination and notifies the developer.

## The button

The only way to request a digest is the button the extension adds to a video's thumbnail. There is no context menu,
no button on the watch page and no toolbar popup.

### Where it appears

On the cards of ordinary videos on three pages: the home page, search results, and the Watch Later playlist. Shorts on
those pages get no button, and no other page has one. The card selectors are verified against YouTube's live markup
when the extension is built.

### What it looks like

- One icon, a grey monochrome note drawn as an inline SVG, on a translucent dark round backdrop, at the top-left of the
  thumbnail, so it does not cover YouTube's own buttons at the top right. An emoji is not used: its colour cannot be
  changed, and the icon briefly turns into a green check.
- It is visible only while the pointer is over the card.
- About a second after the pointer rests on a thumbnail, YouTube may lay its inline preview over the card, so the
  pointer leaves the card. While the preview shows, the same button sits at the preview's top-left, visible while the
  pointer is over the preview, and requests the video the preview plays, with the same feedback.
- There is no text on the button. Its `aria-label` is `Request a digest`, for screen readers.
- The button looks the same on every card: the extension keeps no record of which videos were requested. Cards on the
  home page and in search results are gone within a day or two, so a record would rarely be seen again, and a repeated
  request costs nothing (see below).

### Pressing it

1. The extension sends the video's ID and title to the native host and waits for its reply. The click does not reach
   YouTube: it neither opens the video nor starts its preview. Until the reply comes, the icon is dimmed and the
   button cannot be pressed again.
2. When the host replies `ok`, the icon turns into a green check for about 1.5 seconds, then back into the grey note.
3. When the host does not reply `ok`, a short message in English appears next to the icon for 3 seconds, then the
   icon is the grey note again:

   | Case | Message |
   |---|---|
   | The host is not installed | `yt-digest is not installed` |
   | No reply within 5 seconds | `yt-digest did not respond` |
   | The host replies with an error | `yt-digest failed` |

   The message lives in the button's own shadow root, with `role="status"` for screen readers. It is the only text
   the button ever shows. `alert()` is not used, since it blocks the page, and neither are system notifications,
   which are kept for the digest's result.

While the check or the message shows, the button stays visible even when the pointer leaves the card. Pressing it
again ends that feedback at once and sends a new request.

The button reports only whether the request was sent. A digest that fails later, after the green check, is reported
by a notification (see below), never on the button.

A video can be requested any number of times. Requesting again is how a failed digest is retried; a video whose
digest already exists is skipped (see [Repeated requests](#repeated-requests)), so pressing twice never makes two
digests. As a result, hovering over a card does not tell whether its video was requested. This is deliberate: if it
is ever wanted, the button can ask the host on hover whether the digest exists, without the extension storing
anything.

### What the extension does not know

The extension knows only that a request was accepted, never whether its digest is finished or failed, and it forgets
the request at once. The developer learns the result from a macOS notification:

- one when a digest is finished, and one when it fails, each with the video's title and the result;
- none when a request is accepted (the green check says so), and none when the usage limit of the Claude subscription
  postpones a digest, which waits and runs later, ending in one of the two notifications above;
- clicking a notification does nothing.

yt-digest never removes a video from Watch Later.

### Repeated requests

Whether a video is finished is decided by one file on this Mac, never by a record kept in memory, so the answer is
the same after the worker or the computer restarts.

- A request is a file named by the video's ID in the queue folder. Requesting a video that is already queued writes
  the same file, so it is still one request.
- A finished digest is a file named by the video's ID in the done folder. It appears only after the digest has been
  delivered to the destination: the digest is written elsewhere first and moved into the done folder last, so a
  digest interrupted halfway never counts as finished.
- Before working on a request, the worker looks for the video's file in the done folder. If it is there, the request
  is removed with no notification.
- The destination is not asked: a digest deleted from Heptabase is not made again while its file is in the done
  folder. Deleting that file is how a digest is made again.
- A failed digest leaves no record. Its request is removed from the queue, so it is not retried on its own; the
  developer gets the failure notification, and the details go to the worker's log. Since its file is not in the done
  folder, requesting it again retries it.
- A digest postponed by the usage limit is not a failure: its request stays in the queue and runs later.

### Performance

Every card on a page gets its own button, so the cost per card stays small:

- One custom host element with a closed shadow root per card. All shadow roots share one constructable stylesheet
  (`adoptedStyleSheets`), so the button's CSS is parsed once per page, not once per card.
- A `MutationObserver` on YouTube's content area, not on the whole document, batches its changes into one scan per
  animation frame, and marks the cards it has handled so it never handles one twice.
- The extension stores nothing, so drawing a button reads no storage.

## The native host

Chrome starts the native host for each message and it exits after replying. It does one thing: it puts the request
in the queue. Its native messaging name is `com.yt_digest.host`, which the extension calls and the host's manifest
declares, and the manifest allows only the extension's ID, fixed by the `key` in the extension's manifest.

- The message is `{ videoId, title }`. A `videoId` that is not 11 characters of `A-Z`, `a-z`, `0-9`, `_` or `-` is
  refused, since it becomes a file name.
- It writes `{ videoId, title, requestedAt }` to `<videoId>.json` in the queue folder, first under another name and
  then renamed, so the worker never reads half a file. A request for a video already queued replaces the same file.
- It replies `{ ok: true }`, or `{ ok: false, error }` with `error` either `invalid-request` or `queue-unwritable`.
- It never looks in the done folder and never starts the worker.

## Where the data lives

The queue folder, the done folder and the worker's log live in `~/Library/Application Support/yt-digest/`, outside
the checkout, so what the developer watches cannot be committed and every worktree shares one queue. The environment
variable `YT_DIGEST_DATA_DIR` points the programs at another folder, which tests and checks always do.

| Folder | Holds |
|---|---|
| `queue/` | `<videoId>.json`, one per request, written by the native host |
| `drafts/` | a digest being written, moved into `done/` once delivered |
| `done/` | `<videoId>.md`, one per finished digest |
| `logs/` | `worker.log` |

## The worker

launchd starts the worker when the queue folder changes, at login, and every 30 minutes; launchd never runs two at
once. The worker takes the queued requests one at a time, oldest first, and exits when the queue is empty. For each
request, after the done-folder check in [Repeated requests](#repeated-requests):

1. **Check the video.** It reads the video's details without downloading it, and fails the digest with a reason when
   the video is live or an unaired premiere, private, members-only, age-restricted, or longer than one hour.
2. **Get the transcript,** from the first source that has one: subtitles written for the video in its own language,
   then YouTube's automatic captions in that language, then the audio transcribed with Whisper
   (`mlx-community/whisper-large-v3-turbo`). Machine-translated subtitles are never used, since their errors would
   read as the video's claims.
3. **Write the digest** with `claude -p` (see [Running the model](#running-the-model)).
4. **Deliver it** to the destination, then move the file into the done folder and send the finished notification.

A failure at any step removes the request, logs the details and sends the failed notification, as in
[Repeated requests](#repeated-requests).

### Running the model

The transcript is untrusted, so the model gets only what writing the digest needs:

- the prompt in `prompt/digest.md` as its system prompt, and the transcript on stdin;
- one tool, WebSearch; no file access, no shell, no WebFetch, and `--permission-mode dontAsk`, so anything else is
  refused without stopping to ask;
- no user/project customizations, hooks or `CLAUDE.md` (`--safe-mode`, `--setting-sources ""`), no MCP servers
  (`--strict-mcp-config --mcp-config '{"mcpServers":{}}'`), and no saved session (`--no-session-persistence`);
  Claude Code's administrator-managed policy still applies;
- an empty temporary folder as its working folder, and only `HOME`, `PATH` and `USER` in its environment, so no token or
  key reaches it (`claude` needs `USER` to find its login in the macOS keychain);
- the Opus model, set in one place.

It runs on the developer's Claude subscription. The worker reads its answer from `--output-format json`, and fails
the digest (`The digest was incomplete`) when a section heading of [The digest](#the-digest) is missing, or when the
model runs for more than 10 minutes. Whether the digest is good is the prompt's job, not the worker's.

When the answer says the subscription's usage limit is reached, the digest is postponed, not failed: the request
stays in the queue with no notification, and the next start of the worker tries again. Any other error, including
one the worker does not recognise, fails the digest. The exact wording of the usage-limit error is checked against
the real one the first time it appears.

## The digest

A digest is written in Traditional Chinese, whatever the video's language. Words quoted from the video stay in their
own language, with a link to the moment they are said (`&t=754s`).

It starts with a header the worker writes, never the model, so the transcript cannot change it: the title as the
first line, `# <title>`, which the destination makes the card's title, then the video's link on a line of its own,
then its channel, length, when it was requested, the transcript's source (subtitles, automatic captions or Whisper)
and the model, labelled in Traditional Chinese. The title is the one YouTube gives, or the one the extension sent
when YouTube gives none. The model writes four sections:

1. **Conclusion:** a short paragraph on what the video says and whether it is worth watching.
2. **Main arguments:** each with the time range it covers (`12:34–15:10`), linked to that moment in the video.
3. **The video's sources:** the studies, data, books or people the video cites, or that it cites none.
4. **Assessment:** what is worth learning and what is exaggerated or unsupported. Every claim the model adds comes
   with the source it found; a judgment it found no source for says it is unverified.

## The destination

The first destination is Heptabase. The digest does not depend on it: deduplication uses the done folder, and the
digest's Markdown carries nothing Heptabase-specific.

- The worker creates a note from the digest with the `heptabase` CLI; the digest's first line, `# <title>`, becomes
  the card's title, and the video's link becomes an embedded player (`{{youtube <link>}}`, Heptabase's own syntax).
- It tags the card `yt-digest`, and leaves Heptabase's Created by AI mark on it.
- When Heptabase is not running, the worker starts it with `heptabase start`; if delivery still fails, the digest
  fails.

## Notifications

macOS notifications in English, sent with `osascript`:

| When | Title | Text |
|---|---|---|
| A digest is delivered | `Digest ready` | the video's title |
| A digest fails | `Digest failed` | the video's title and the reason, such as `No transcript available` |
