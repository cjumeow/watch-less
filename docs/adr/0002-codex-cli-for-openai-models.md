# Codex CLI for OpenAI models

Date: 2026-10-26. Status: accepted.

## Context

The developer wants to choose between Claude and OpenAI's models for a digest. yt-digest runs only on this Mac with
the developer's own subscriptions and never with an API key, so OpenAI's API is out: it would need a key and bill per
token. Codex CLI (`codex exec`) signs in with the developer's ChatGPT plan, as `claude -p` does with the Claude
subscription.

## Decision

OpenAI models are run through `codex exec`, chosen by the model's provider in `PROVIDERS`, from the same input on
stdin and with the same checks as `claude -p`. Codex has no `--tools ""`, so the isolation is assembled from its
configuration: the digest prompt as `model_instructions_file`, a read-only sandbox, no approvals, no web search, no
MCP servers, the tool features switched off, none of the user's configuration, rules or sessions, an empty working
folder and a three-variable environment. The answer is read from `--output-last-message`, not from the terminal.

## Consequences

- A digest from an OpenAI model is a little less isolated than a Claude one: a few Codex tools and its skill list
  cannot be removed (the spec lists them). A read-only sandbox in an empty folder bounds them.
- The flags are those of Codex CLI 0.164.0 and may change; the fake-`codex` tests record the exact arguments, so a
  change is a visible edit, but only a real run proves Codex still accepts them.
- Codex's usage-limit message is not known, so a limit fails the digest until the message is observed.
- Switching to the OpenAI API later would mean an API key, which the project's principles forbid; it would need a new
  decision.
