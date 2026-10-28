---
name: commit-and-pull-request-convention
description: How commits and pull requests are written in yt-digest, covering branch names, Conventional Commits subjects, commit bodies, the changelog, pull request titles and descriptions, and releases. Use before committing, writing or rewording a commit message, pushing a branch, or opening, describing or merging a pull request, or cutting a release in this repository, even for a one-line change.
---

# Commits and pull requests

A pull request is squash-merged: one change becomes one commit on `main`. Its subject is the pull request title, and
its body is the messages of the pull request's commits. Write both for someone who never saw the conversation: the
chat with the agent is gone after the session, and the history on `main` is what stays.

The `check-pull-request-conventions` workflow checks what a program can: the title's format and length, and the
changelog entry of a `feat` or `fix`. The same title rule, `scripts/check-title.mjs`, runs on every commit's subject
through the `commit-msg` hook in `.githooks/`, which `npm install` turns on, so a long subject is refused before it
becomes a pull request title. Check a pull request title you write by hand with `node scripts/check-title.mjs
"<title>"`. The rest is for you and the reviewer.

## Branches

- Work on a branch from `main`, named `<type>/<topic>` in kebab-case, with a type from the table below:
  `feat/thumbnail-button`, `fix/rolling-captions`.
- Commit locally as you go. Before pushing, squash the work-in-progress commits into the ones a reviewer should read
  (usually one, whose message is the one `main` should get), and run the commands in `AGENTS.md`.
- When the change is ready, push the branch and open its pull request without asking first.
- Nothing private enters the repository, in code, fixtures, commit messages or pull requests: what the developer
  watches (video IDs, titles, channels), their Heptabase cards, transcripts of real videos, local paths with their
  user name, tokens. The repository is public, a watch list shows what a person reads, and a real transcript is
  someone else's text. Tests and examples use made-up videos and transcripts written for the test.

## Commit messages

- **Subject:** [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), `<type>: <sentence>`, no scope.
  The sentence is English in the imperative (it completes "this commit will ..."), starts lowercase, has no trailing
  period, and fits in 72 characters, where GitHub starts cutting titles. It says what changes for the user; add the
  reason after a comma when it is not obvious.
- **Type:**

  | Type | When |
  |---|---|
  | `feat` | the user can do something they could not before: a new entry point, a new section in the digest, a fallback |
  | `fix` | something that should already have worked now does |
  | `refactor` | the code changes and nothing anyone sees does |
  | `docs` | documentation, `AGENTS.md` and the skills in `.claude/skills/`, for developers |
  | `test` | tests only |
  | `ci` | the workflows in `.github/workflows/` |
  | `chore` | anything else, such as a dependency update |

  The digest prompt in `prompt/` is part of the product, so a change to what a digest says or how it judges evidence
  is a `feat` or a `fix`, not `docs`.

  ```text
  feat: add a digest button to each video thumbnail on YouTube
  fix: drop the repeated lines of rolling auto-generated captions
  feat: transcribe the audio with Whisper when a video has no subtitles
  refactor: move caption parsing out of the worker
  ```

  Not `feat: added button` (past tense), `fix: caption bug` (no verb), `chore: update stuff` (says nothing),
  `fix: edit worker.ts` (files, not the change), or `feat(extension): add button` (no scope).
- **Body,** when the subject is not enough: prose wrapped at 120 columns that says what was wrong or missing and what
  happens now. Not a list of the files edited, and not the story of how the fix was found.
- Use the terms in `GLOSSARY.md` and the code's names.
- **Trailers:** a commit an agent wrote ends with the agent's `Co-Authored-By:` trailer. Commits are not signed off.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries collect under
`## [Unreleased]` until a release moves them under its version; the changelog is the history of what the user can do.

- A `feat` or `fix` adds an entry under `## [Unreleased]`, in its category: Added, Changed, Deprecated, Removed, Fixed
  or Security. Write it for the user: what is different for them, not how the code changed. Other types get no entry;
  a change the user would notice is a `feat` or a `fix`.
- An entry is one line, two at most: the thing the user meets (the button on a thumbnail, the digest in Heptabase, a
  notification), what is different, and a short example when it says more than an explanation would.
  The reason, how it works, edge cases and trade-offs go in the pull request.

## Releases

A release is a tag `v<version>` on `main`, with [Semantic Versioning](https://semver.org/spec/v2.0.0.html) versions.
Pushing the tag runs the `publish-release` workflow, which makes the tag's changelog section the GitHub release's
notes; it fails when the tag is off `main`, differs from `package.json`'s version, or has no section.

1. Open a pull request titled `chore: release <version>` on a branch `chore/release-<version>`. It moves the entries
   under `## [Unreleased]` to `## [<version>] - <YYYY-MM-DD>`, leaves `## [Unreleased]` empty above it, updates the
   link definitions at the end of the file, and sets `<version>` in every `package.json`, the workspaces' pins on
   `@yt-digest/shared`, `extension/manifest.json` and `package-lock.json`.
2. Release notes are read once, by someone meeting the release: merge entries a later one in the same release
   undoes or rewrites, so the section says what the release does.
3. After the pull request is merged, tag its commit on `main` and push the tag:
   `git tag v<version> origin/main && git push origin v<version>`.

## Pull requests

- **Title:** the subject `main` should get, in the format above.
- **Description:** written for the reviewer deciding whether to merge, and for whoever later follows the commit back
  to it. Up to four sections, each answering one question, in this order:

  | Section | Answers | Holds |
  |---|---|---|
  | `## Why` | Is the problem worth solving? | what was wrong or missing |
  | `## What changes` | Is this the right change, and where to look? | what is different for the user |
  | `## Trade-offs` | Is the price acceptable? | what gets worse, what was given up, the alternative not taken |
  | `## Verification` | Is the risk acceptable? | each claim with its evidence and how sure it is, what is still unchecked, what to watch for |

  Why, What changes and Verification are always there: a passing CI run does not show that a change was proven, and
  what counts as evidence is in [`verify`](../verify/SKILL.md). Leave Trade-offs out when nothing was given up; never
  fill a section for its own sake.
- **What changes** opens with one or two sentences that say what the change is as a whole; a single change ends
  there. Several separate changes follow as one level of bullets, each starting with the bold name of the thing that
  changes (a program, a file, a section of the digest) and one sentence on how. Items that share attributes go in a
  table. No file lists, no nested bullets, and no order of implementation.
- The description ends with the agent's generated-with line when an agent wrote it.
- Before opening the pull request, run `/code-review` on the change.
- Merge a pull request only under the conditions in `AGENTS.md`, Sessions and merging; the rest the developer merges.
