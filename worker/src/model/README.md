# Writing a digest

`createModelStep()` implements `ModelStep.writeDigest()` without running a real model during tests. It formats the
video link, single-line title, quoted description and timed transcript as `prompt/README.md` describes, sends them on
stdin, and reads one JSON result. Fractional transcript starts are floored to whole seconds for `[m:ss]` or
`[h:mm:ss]` timestamps. The three section headings of the digest's language are checked mechanically; evidence quality remains the prompt's
responsibility.

## Isolation and tool contract

Use `claude -p --model <the digest's model> --system-prompt-file <absolute path to prompt/digest.md>`. The file replaces the default
system prompt. The path is resolved relative to the module's two supported layouts: `worker/src/model/` when tests
read the source, and `worker/dist/` for the built worker. The current working folder is never used to find the prompt.

The command has `--tools ""` (no tools at all) and `--permission-mode dontAsk`, plus `--safe-mode`,
`--setting-sources ""`, `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` and `--no-session-persistence`.
Safe mode disables personal/project customizations while preserving subscription authentication. Bare mode is not
used: it disables subscription/keychain authentication. Administrator-managed Claude Code policy still applies.
These restrictions are CLI controls, not operating-system isolation.

Only `HOME`, `PATH` and `USER` are forwarded, omitting unset variables rather than stringifying them. No API key,
OAuth token environment variable or caller-selected config path is forwarded. macOS may itself add
`__CF_USER_TEXT_ENCODING`; tests validate that platform field separately. Each call starts in a private empty
folder, removed after its child closes. No shell is used and model text is never executed.

Each digest names its model and its language: the queue file's when it has them, and otherwise `DEFAULT_SETTINGS`
from `@yt-digest/shared`, English and `claude-haiku-5-5`. `providerOf(model)` picks the tool: `claude -p` above for a
Claude model, `codex exec` below for an OpenAI one. The model is recorded in the header, and the language sets the
headings sent on stdin and checked in the answer. The executable must be available on the worker's `PATH` and support these CLI flags.
The eval runner uses the same customization/MCP flags, but stream-json output to capture searches.

## Codex

`codex.ts` runs `codex exec --model <model> --sandbox read-only --ignore-user-config --ignore-rules --ephemeral
--skip-git-repo-check --cd <empty folder> -c model_instructions_file=<prompt/digest.md> -c approval_policy="never"
-c web_search="disabled" -c mcp_servers={} --disable <tool features> --output-last-message <file> -`, with the same input
on stdin, the same environment and the same `run-command.ts` (10-minute timeout, 8 MiB cap). Every flag was taken from
`codex exec --help`, Codex's configuration reference and `codex debug prompt-input`, which prints what the model sees
without calling it; none is a guess. The folder holds `work/` (Codex's working folder, always empty) and `answer.txt`
beside it. The answer is read from that file by `readCodexAnswer`: a non-zero exit, a missing file or a missing heading
fails the digest. Codex's usage-limit message is unconfirmed, so it fails like any other error. What Codex cannot
restrict is in `docs/spec.md`, Running the model, and [ADR 2](../../../docs/adr/0002-codex-cli-for-openai-models.md).

## Failures and verification

A missing heading fails with `The digest was incomplete`. Known usage-limit messages return `postponed`; the
worker already keeps that request queued without a notification. Everything unrecognized fails, and stdout/stderr
are retained in the local worker log. Fixture provenance and the unconfirmed JSON limit shape are documented in
[`fixtures/README.md`](fixtures/README.md).

After ten minutes the child receives SIGTERM, then SIGKILL after two seconds if it is still running. A combined
8 MiB stdout/stderr cap prevents unbounded output buffering. Cleanup waits for the child to close.

Run `npx vitest run worker/src/model/` for the two issue-confirmed seams: reading fixture answers, and the complete
step with a fake `claude` or `codex` first on `PATH` (`index.test.ts`, `codex.test.ts`). The fake records what it received outside the empty model folder. Tests
never call the real model or use the subscription. Build verification must use a clean snapshot of a commit and
exercise the actual `worker/dist/worker.js` with fake external commands and a temporary data folder.

The actual JSON-mode usage-limit message remains unproven until the subscription's limit is first met.
