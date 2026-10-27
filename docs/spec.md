# yt-digest spec

What the first version of yt-digest does. The terms are defined in [`GLOSSARY.md`](../GLOSSARY.md). A request
travels from the Summarize item through the native host into the queue, and the worker turns it into a digest, delivers it
to the destination and notifies the developer.

## The Summarize item

A digest is requested with **Summarize**, an item the extension adds first to YouTube's own video menu, the ⋮ of a
video's card and the ⋯ under the player; the result shows in a toast. There is no button on thumbnails or in the
player and no context menu; the extension's toolbar popup (below) chooses the language and the model. The item replaced buttons on thumbnails, which flickered and fought
YouTube's inline preview; the developer confirmed it in [`docs/prototypes/menu-item.html`](prototypes/menu-item.html).

### Where it appears

- In the ⋮ menu of an ordinary video's card on three pages, the home page, search results and the Watch Later
  playlist, and among the related videos beside the player on the watch page.
- In the ⋯ menu under the player on the watch page, after Like and Share, for the video playing.
- Not in the menu of a mix, a playlist or a Short, and on no other page.

The selectors are verified against YouTube's live markup when the extension is built, and match the menu buttons by
their place in the page, not by their label, which changes with YouTube's language.

### What it looks like

- The word `Summarize`, after Tabler's message-ai icon drawn in `currentColor`, so it matches YouTube's own items in
  both themes. It is the first item, above YouTube's own.
- The item looks the same in every menu: the extension keeps no record of which videos were requested. A repeated
  request costs nothing (see below).

### How the menu is found

YouTube opens one shared menu for the whole page, in `ytd-app > ytd-popup-container > tp-yt-iron-dropdown`, and fills
it anew each time; the menu holds no video. So the extension remembers which ⋮ or ⋯ was pressed, with a `pointerdown`
or `click` listener in the capture phase that runs before YouTube's own, and adds the item when the menu's list
appears. Two kinds of menu are in use:

| Where | Menu button | The list the item is put first in |
|---|---|---|
| A card on the home page and in Watch Later (`yt-lockup-view-model`) | `.ytLockupMetadataViewModelMenuButton button` | `yt-sheet-view-model … yt-list-view-model[role="menu"]` |
| A search result (`ytd-video-renderer`) | `#menu ytd-menu-renderer yt-icon-button#button > button` | `ytd-menu-popup-renderer > tp-yt-paper-listbox#items` |
| The watch page | `ytd-watch-metadata ytd-menu-renderer yt-icon-button#button > button` | the same `ytd-menu-popup-renderer` |

The video is read when the menu button is pressed: on a card, its ID from the thumbnail's link and its title from the
card; on the watch page, its ID from the page's URL and the title YouTube shows below the player. Moving to another
video, YouTube changes the URL about a second before the title, so the ⋯ pressed in that second sends the new video
with no title. A press outside the menu takes the item away from the last menu, since YouTube may reuse its list for a
menu that is not a video's.

### Choosing it

1. Choosing the item, with the pointer or with Enter or Space, closes the menu, as YouTube's own items do, by
   dispatching the Escape key YouTube's menu listens for. The press does not reach YouTube's menu, which would take
   it for one of its own items.
2. The extension sends the video's ID and title to the native host and waits for its reply, at most 5 seconds.
3. A toast at the bottom left of the window shows the result for 3 seconds, with the video's title on a second line,
   in the inverse of the page's theme: light on YouTube's dark theme, dark on its light theme. A new toast replaces
   the one showing. Until the reply comes nothing shows, and the menu can be opened and the item chosen again.

   | Case | Toast |
   |---|---|
   | The host replies `ok` | a green check and `Digest requested` |
   | The host is not installed | a red mark and `yt-digest is not installed` |
   | No reply within 5 seconds | a red mark and `yt-digest did not respond` |
   | The host replies with an error | a red mark and `yt-digest failed` |

   The toast has `role="status"`, for screen readers. `alert()` is not used, since it blocks the page, and neither
   are system notifications, which are kept for the digest's result.

The toast reports only whether the request was sent. A digest that fails later, after `Digest requested`, is reported
by a notification (see below), never in the toast.

A video can be requested any number of times. Requesting again is how a failed digest is retried; a video whose
digest already exists is skipped (see [Repeated requests](#repeated-requests)), so choosing Summarize twice never
makes two digests. As a result, the menu does not tell whether its video was requested. This is deliberate: if it is
ever wanted, the extension can ask the host when the menu opens whether the digest exists, without storing anything.

### What the extension does not know

The extension knows only that a request was accepted, never whether its digest is finished or failed, and it forgets
the request at once. The developer learns the result from a macOS notification:

- one when a digest is finished, and one when it fails, each with the video's title and the result;
- none when a request is accepted (the toast says so), and none when the usage limit of the Claude subscription
  postpones a digest, which waits and runs later, ending in one of the two notifications above;
- clicking the finished notification opens the digest: its card in Heptabase or its page in Notion.

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

- No page gets anything until a menu opens: the extension adds one element to an open video menu, and one toast to
  the page the first time a request is answered.
- A `MutationObserver` on `ytd-popup-container` only, not on the whole document or YouTube's content area, puts the
  item in a menu's list.
- Opening a menu reads no storage: the service worker reads the popup's settings only when a request is sent.

### The toolbar popup

The extension's button in Chrome's toolbar opens a popup, which the developer confirmed in
[`docs/prototypes/popup.html`](prototypes/popup.html), and which picks what the next digests are written with.

- **Digest language,** one of the languages in `LANGUAGES` of `@yt-digest/shared`, from a menu: English, 繁體中文,
  简体中文, 日本語, 한국어 or Español.
- **Model,** a Claude / OpenAI switch and that provider's models, from `PROVIDERS`. The prototype's warning that a provider's command-line tool is not installed is not
  built: the popup cannot see this Mac's tools without asking the native host.
- **Save to,** Heptabase or Notion, from `DESTINATIONS`. For Notion, an optional **Folder page**: a Notion page's link
  or ID is pasted, and the popup keeps and shows the 32-character ID. The hint under it says: each video becomes a
  new page inside this page; empty, in the Private section. A text that is not a page is refused and not saved. The
  prototype's warning that `ntn` is signed out is not built, for the same reason as the model's.
- A choice is saved as soon as it is made, with `Saved` shown briefly, and applies to the next request. Opened for
  the first time, the popup shows `DEFAULT_SETTINGS`: English, Haiku 5.5 and Heptabase.
- The extension stores only these values, `language`, `model`, `destination` and `notionFolderPage`, in `chrome.storage.local`, which needs the
  `storage` permission. It stores nothing about videos.
- The service worker reads them when a request is sent and sends `{ videoId, title, language, model, destination }`, with `notionFolderPage` when a page is set. A value that
  is missing or no longer one of the known IDs, such as a removed model, is replaced by its default.
- The toolbar icon is Tabler's message-ai (MIT), the Summarize item's icon, at 16, 32, 48 and 128 pixels.

## The native host

Chrome starts the native host for each message and it exits after replying. It does one thing: it puts the request
in the queue. Its native messaging name is `com.yt_digest.host`, which the extension calls and the host's manifest
declares, and the manifest allows only the extension's ID, fixed by the `key` in the extension's manifest.

- The message is `{ videoId, title }` with `language`, `model`, `destination` and `notionFolderPage` when the popup's settings are sent; one that is
  not a known ID is refused, and so is a folder page that is not 32 hexadecimal characters, since the model and the
  page become command-line arguments. A `videoId` that is not 11 characters of `A-Z`, `a-z`, `0-9`, `_` or `-` is
  refused, since it becomes a file name.
- It writes `{ videoId, title, requestedAt }`, with those settings when the request has them, to `<videoId>.json` in the queue folder, first under another name and
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
3. **Write the digest** with `claude -p`, or `codex exec` for an OpenAI model (see [Running the model](#running-the-model)).
4. **Deliver it** to the destination, then move the file into the done folder and send the finished notification.

A failure at any step removes the request, logs the details and sends the failed notification, as in
[Repeated requests](#repeated-requests).

### Running the model

The transcript and the description are untrusted, so the model gets only what writing the digest needs. The model the
request asks for (Haiku 5.5, `claude-haiku-5-5`, when it asks for none; set in one place) picks the tool by its
provider: `claude -p` for a Claude model, `codex exec` for an OpenAI one. Both run on the developer's own
subscription, Claude's or ChatGPT's, and never with an API key.

**Claude (`claude -p`):**

- the prompt in `prompt/digest.md` as its system prompt, and the video's title, description and transcript on stdin;
- no tools at all (`--tools ""`): no web search, no file access, no shell, and `--permission-mode dontAsk`, so
  anything it tries is refused without stopping to ask;
- no user/project customizations, hooks or `CLAUDE.md` (`--safe-mode`, `--setting-sources ""`), no MCP servers
  (`--strict-mcp-config --mcp-config '{"mcpServers":{}}'`), and no saved session (`--no-session-persistence`);
  Claude Code's administrator-managed policy still applies;
- an empty temporary folder as its working folder, and only `HOME`, `PATH` and `USER` in its environment, so no token or
  key reaches it (`claude` needs `USER` to find its login in the macOS keychain).

**OpenAI (`codex exec`)**, isolated as closely as Codex allows ([ADR 2](adr/0002-codex-cli-for-openai-models.md)):

- the prompt as Codex's instructions (`-c model_instructions_file=<prompt/digest.md>`, which replaces Codex's built-in
  ones), and the same input on stdin (`-`);
- a read-only sandbox (`--sandbox read-only`), no approvals asked (`approval_policy="never"`), no web search
  (`web_search="disabled"`), no MCP servers (`mcp_servers={}`), and the features that give a model tools turned off
  (`--disable shell_tool`, `unified_exec`, `apps`, `plugins`, `hooks`, `multi_agent`, `view_image`,
  `image_generation`, `computer_use`, `browser_use`);
- none of the developer's own Codex configuration, rules or saved sessions (`--ignore-user-config`,
  `--ignore-rules`, `--ephemeral`), while the ChatGPT login in `~/.codex` is still used;
- an empty temporary folder as its working folder (`--cd`, `--skip-git-repo-check`), and the same
  `HOME`, `PATH` and `USER` environment, so no `OPENAI_API_KEY` or `CODEX_HOME` reaches it;
- the answer read from the file named by `--output-last-message`, kept beside the working folder and not in it.

What Codex cannot restrict the way `claude -p` can: it has no setting for no tools at all, so after the features
above are off the model still has `apply_patch` (the read-only sandbox refuses its writes), the request for user
input (nobody answers in a non-interactive run) and a clock tool; Codex's own skill list and environment description
still reach the model, since no flag removes them; and Codex refreshes its login token in `~/.codex` as it always
does. These are CLI controls, not operating-system isolation.

The worker fails the digest (`The digest was incomplete`) when a section heading of [The digest](#the-digest) is
missing, or when the model runs for more than 10 minutes or writes more than 8 MiB. Whether the digest is good is
the prompt's job, not the worker's.

When Claude's answer says the subscription's usage limit is reached, the digest is postponed, not failed: the request
stays in the queue with no notification, and the next start of the worker tries again. Any other error, including
one the worker does not recognise, fails the digest. The exact wording of the usage-limit error is checked against
the real one the first time it appears. Codex's usage-limit message is not known yet, so a digest that meets
ChatGPT's limit fails like any other error; the worker will postpone it once the message is observed.

## The digest

A digest is written in the language the request asks for, whatever the video's language: English, 繁體中文, 简体中文,
日本語, 한국어 or Español, and English until the extension lets the developer choose. It reports what the speaker says as they say it,
neither judging nor adding to it, and corrects the words automatic captions mishear where the context makes the
intended word plain. A quote has a link to the moment it is said (`&t=754s`).

It starts with a header the worker writes, never the model, so the transcript cannot change it: the title as the
first line, `# <title>`, which the destination makes the card's title, then the video's link on a line of its own,
then its channel, linked to the channel's page, its length, when it was requested and the model, labelled in English
whatever the digest's language (`Channel`, `Length`, `Added`, `Model`). The title is the one YouTube gives, or the one the extension sent when
YouTube gives none. The model writes three sections, with headings in the digest's language that the worker gives it
and checks:

1. **Conclusion:** two to four sentences on the video's main point and the conclusion the speaker reaches.
2. **Main arguments:** one bullet per three minutes of video, at least two and at most ten, a number the worker
   counts and gives the model; each starts with the time range it covers (`12:34–15:10`), linked to that moment in
   the video, and the ranges do not overlap. A range or a moment the model leaves without its link, the worker links.
3. **References:** the sources the description lists, each its name as a link, and the articles, repositories, books
   and the like the speaker names as sources, each its name and the moment it is named, linked only when the
   description links them; nothing else on the line. Nothing is searched for or
   guessed. Sponsor, affiliate, merchandise and social links are left out, and so are vague appeals that name
   nothing.

## The destination

The request says which destination a digest goes to: Heptabase, the default, or Notion. The digest does not depend on
it: deduplication uses the done folder, and the digest's Markdown carries nothing specific to either.

- The worker creates a note from the digest with the `heptabase` CLI; the digest's first line, `# <title>`, becomes
  the card's title, and the video's link becomes an embedded player (`{{youtube <link>}}`, Heptabase's own syntax).
- It tags the card `yt-digest`, and leaves Heptabase's Created by AI mark on it.
- When Heptabase is not running, the worker starts it with `heptabase start`; if delivery still fails, the digest
  fails.

### Notion

- The worker creates a page with Notion's official CLI, `ntn pages create`, signed in once with `ntn login`; the
  login is in the macOS keychain, so there is no token or OAuth code of our own, and no Notion app has to be open.
- The digest's Markdown goes on stdin, which is always closed after it: `ntn` waits forever on a stdin left open. The
  first line, `# <title>`, becomes the page's title, and the video's link becomes a `<video src="<link>"></video>`
  block, which Notion embeds as a player.
- With a folder page, `--parent page:<id>` makes the digest a new page inside it; without one the page goes to the
  Private section. Notion pages have no tags, so there is no `yt-digest` tag.
- `ntn` runs with only `HOME`, `PATH` and `USER`, and for at most 90 seconds. When it is not installed, or its
  login is gone, the digest fails with `Notion CLI is not installed: run sh scripts/setup.sh` or `Notion CLI is not
  signed in: run ntn login`.

## Notifications

macOS notifications in English, titled `yt-digest`, sent with `terminal-notifier`:

| When | Subtitle | Text | Clicking it |
|---|---|---|---|
| A digest is delivered | `Digest ready` | the video's title | opens the digest: `heptabase://card/<id>` in Heptabase, or the page's link in Notion |
| A digest fails | `Digest failed` | the video's title and the reason, such as `No transcript available` | does nothing |

The destination gives the link when it delivers. macOS lets `terminal-notifier` show notifications only after the
developer allows it, which `setup.sh` asks for by starting it once. When it is not installed or not allowed, the
worker shows the same notification with `osascript`, which cannot open anything. A video's title that starts with a
hyphen is shown with a non-breaking hyphen, so `terminal-notifier` cannot read it as an option.
