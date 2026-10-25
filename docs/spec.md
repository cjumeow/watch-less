# yt-digest spec

What the first version of yt-digest does. The terms are defined in [`GLOSSARY.md`](../GLOSSARY.md). Sections are
added as they are decided; the pipeline that turns a request into a digest (the transcript, the model, the
destination) is not specified yet, and until it is, the architecture in `README.md` stands.

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
- There is no text on the button. Its `aria-label` is `Request a digest`, for screen readers.
- The button looks the same on every card: the extension keeps no record of which videos were requested. Cards on the
  home page and in search results are gone within a day or two, so a record would rarely be seen again, and a repeated
  request costs nothing (see below).

### Pressing it

1. The extension sends the video's ID and title to the native host and waits for its reply. The click does not reach
   YouTube: it neither opens the video nor starts its preview. Until the reply comes, the button cannot be pressed
   again.
2. When the host replies `ok`, the icon turns into a green check for about 1.5 seconds, then back into the grey note.
3. When the host does not reply `ok` (it is not installed, it fails, or it does not reply in time), a short message
   in English appears next to the icon for 3 seconds, such as `yt-digest is not installed`, then the icon is the grey
   note again. It is the only text the button ever shows. `alert()` is not used, since it blocks the page.

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
