# The digest prompt

[`digest.md`](digest.md) is the system prompt `claude -p` follows to write a digest. This file is the contract between
it and the worker's model step: what the worker sends the model, and what it gets back. A change to either side
changes both, in the same pull request. How the model is run (its tools, flags and environment) is in
[`docs/spec.md`, Running the model](../docs/spec.md#running-the-model).

## What the worker sends

On stdin, as UTF-8 text, one video:

```text
Video: https://www.youtube.com/watch?v=<id>
Title: <the video's title>
Transcript:
[0:00] <words said from this moment>
[0:07] <words said from this moment>
[1:02:03] <words said from this moment>
```

- `Video:` is the video's link, always `https://www.youtube.com/watch?v=` followed by its ID. The model links to a
  moment by appending `&t=<seconds>s` to it.
- `Title:` is the title on one line.
- `Transcript:` is followed by one line per transcript segment, in order: the moment it starts, as `[m:ss]` under an
  hour and `[h:mm:ss]` from an hour on, a space, and its words on one line.

Everything on stdin, the title included, is untrusted: the prompt treats it as data and never as instructions.

## What the model returns

The digest's four sections and nothing else, in this order, each starting with its heading on a line of its own:

| Heading | Section |
|---|---|
| `## 結論` | Conclusion |
| `## 主要論點` | Main arguments, each with its time range |
| `## 影片的來源` | The video's sources, or `影片未引用任何來源。` |
| `## 評估` | Assessment |

The worker fails the digest (`The digest was incomplete`) when one of these four lines is missing. The model writes no
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
