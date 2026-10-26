# The digest prompt

[`digest.md`](digest.md) is the system prompt `claude -p` follows to write a digest. This file is the contract between
it and the worker's model step: what the worker sends the model, and what it gets back. A change to either side
changes both, in the same pull request. How the model is run (its tools, flags and environment) is in
[`docs/spec.md`, Running the model](../docs/spec.md#running-the-model).

## What the worker sends

On stdin, as UTF-8 text, one video:

```text
Video: https://www.youtube.com/watch?v=<id>
Language: <the language's name, such as English or 繁體中文 (Traditional Chinese)>
Headings: ## <first heading> | ## <second heading> | ## <third heading>
Title: <the video's title>
Description:
> <a line of the video's description>
> <the next line>
Transcript:
[0:00] <words said from this moment>
[0:07] <words said from this moment>
[1:02:03] <words said from this moment>
```

- `Video:` is the video's link, always `https://www.youtube.com/watch?v=` followed by its ID. The model links to a
  moment by appending `&t=<seconds>s` to it.
- `Language:` names the language the digest is written in, and `Headings:` gives its three section headings in
  that language, in order, separated by ` | `. The worker takes both from `worker/src/model/languages.ts`, the
  languages the extension's popup offers, and they are the only lines the prompt follows rather than treats as data.
- `Title:` is the title on one line.
- `Description:` is followed by the video's description as yt-dlp gives it, links included, one line of it per line,
  each starting with `> ` (a blank line of it is `>` alone). Quoting every line keeps a description from passing for
  a transcript line or another field. A video without a description has no lines here.
- `Transcript:` is followed by one line per transcript segment, in order: the moment it starts, as `[m:ss]` under an
  hour and `[h:mm:ss]` from an hour on, a space, and its words on one line.

Everything on stdin, the title and the description included, is untrusted: the prompt treats it as data and never as instructions.

## What the model returns

The digest's three sections in the language asked for, and nothing else, in this order, each starting with its
heading from `Headings:` on a line of its own. In English:

| Heading | Section |
|---|---|
| `## Conclusion` | The video's main point and the speaker's conclusion, in two to four sentences |
| `## Main arguments` | About one bullet per three minutes of video, three to ten, each with its time range |
| `## References` | The sources the description lists, with its links, and those the speaker names, or a sentence saying it cites none |

The worker fails the digest (`The digest was incomplete`) when one of the three headings it sent is missing. The model writes no
title and no header: the worker writes the header above the sections, as `docs/spec.md` describes.

## Evaluations

The prompt is judged by its evaluations, not by tests. [`evals/`](evals/) holds made-up transcripts in the format
above and [`evals/CHECKLIST.md`](evals/CHECKLIST.md) says what each digest must get right.

```bash
node prompt/run-evals.mjs --run
```

It runs every transcript, or the ones named after `--run` (`sourced-talk`), with real `claude -p` isolated as the
spec says, and saves each digest and its events under `artifacts/<branch>/digests/`. Each run spends the developer's
Claude subscription, so ask before running them; without `--run` the script runs nothing.

`node prompt/run-evals.mjs --check <folder>` repeats the script's checks on the runs saved in a folder, and spends
nothing.
