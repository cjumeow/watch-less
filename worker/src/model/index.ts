import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { DigestFailure } from "../digest-failure.js";
import { readCodexAnswer, readModelAnswer } from "./answer.js";
import { runCodex } from "./codex.js";
import { runCommand } from "./run-command.js";
import { isModelId, LANGUAGES, providerOf } from "@yt-digest/shared";
import { HEADINGS } from "./languages.js";
import type { DigestInput, ModelStep } from "./model-step.js";

export type * from "./model-step.js";

// The module is read from src/model by tests and bundled into worker/dist/worker.js for launchd.
const PROMPT_FILE = resolve(
  import.meta.dirname,
  basename(import.meta.dirname) === "dist" ? "../../prompt/digest.md" : "../../../prompt/digest.md",
);

export function createModelStep(): ModelStep {
  return {
    async writeDigest(input) {
      let folder: string | undefined;
      try {
        folder = await mkdtemp(join(tmpdir(), "yt-digest-model-"));
        const expected = { headings: HEADINGS[input.language], model: input.model };
        const stdin = formatInput(input);
        const result =
          isModelId(input.model) && providerOf(input.model) === "openai"
            ? await runCodex(folder, input.model, PROMPT_FILE, stdin)
            : await runClaude(folder, input.model, stdin);
        try {
          return result.tool === "codex"
            ? readCodexAnswer(result.answer, result.exitCode, expected)
            : readModelAnswer(result.stdout, result.exitCode, expected);
        } catch (cause) {
          const reason = cause instanceof DigestFailure ? cause.reason : "The model failed to write a digest";
          throw new DigestFailure(reason, { cause: { ...result, error: cause } });
        }
      } catch (cause) {
        if (cause instanceof DigestFailure) throw cause;
        throw new DigestFailure("Could not run the model", { cause });
      } finally {
        if (folder !== undefined) await rm(folder, { recursive: true, force: true });
      }
    },
  };
}

async function runClaude(folder: string, model: string, input: string) {
  return {
    tool: "claude" as const,
    ...(await runCommand(
      "claude",
      [
        "-p",
        "--model",
        model,
        "--system-prompt-file",
        PROMPT_FILE,
        // No tools at all: the digest needs only the transcript and the description it is given.
        "--tools",
        "",
        "--permission-mode",
        "dontAsk",
        "--safe-mode",
        "--setting-sources",
        "",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--no-session-persistence",
        "--output-format",
        "json",
      ],
      folder,
      input,
    )),
  };
}

/** The language's own name, as the popup shows it, with its English name when that differs. */
const LANGUAGE_NAMES = Object.fromEntries(
  LANGUAGES.map(({ id, name, englishName }) => [id, name === englishName ? name : `${name} (${englishName})`]),
) as Record<DigestInput["language"], string>;

function formatInput(input: DigestInput): string {
  return [
    `Video: https://www.youtube.com/watch?v=${input.videoId}`,
    `Language: ${LANGUAGE_NAMES[input.language]}`,
    `Headings: ${HEADINGS[input.language].join(" | ")}`,
    `Main arguments: ${String(argumentCount(input.transcript))}`,
    `Title: ${oneLine(input.title)}`,
    "Description:",
    // Quoted line by line, so no line of the description can pass for a transcript line or another field.
    ...(input.description.trim() === ""
      ? []
      : input.description
          .trim()
          .split(/\r\n?|[\n\v\f\u0085\u2028\u2029]/)
          .map((line) => `> ${line}`.trimEnd())),
    "Transcript:",
    ...input.transcript.lines.map((line) => `[${timestamp(line.startSeconds)}] ${oneLine(line.text)}`),
    "",
  ].join("\n");
}

/**
 * How many main arguments the digest has: one per three minutes of transcript, at least two and at most ten. The
 * worker counts, because the model does not keep to a rule it has to work out itself.
 */
function argumentCount(transcript: DigestInput["transcript"]): number {
  const minutes = (transcript.lines.at(-1)?.startSeconds ?? 0) / 60;
  return Math.min(10, Math.max(2, Math.round(minutes / 3)));
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function timestamp(startSeconds: number): string {
  const total = Math.floor(startSeconds);
  const seconds = String(total % 60).padStart(2, "0");
  const minutes = Math.floor(total / 60);
  return total < 3600
    ? `${String(minutes)}:${seconds}`
    : `${String(Math.floor(total / 3600))}:${String(minutes % 60).padStart(2, "0")}:${seconds}`;
}
