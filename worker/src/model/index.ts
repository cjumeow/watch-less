import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { DigestFailure } from "../digest-failure.js";
import { readModelAnswer } from "./answer.js";
import { LANGUAGES } from "@yt-digest/shared";
import { HEADINGS } from "./languages.js";
import type { DigestInput, ModelStep } from "./model-step.js";

export type * from "./model-step.js";

// The module is read from src/model by tests and bundled into worker/dist/worker.js for launchd.
const OUTPUT_LIMIT_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10 * 60 * 1000;
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
        const result = await runModel(folder, input.model, formatInput(input));
        try {
          return readModelAnswer(result.stdout, result.exitCode, {
            headings: HEADINGS[input.language],
            model: input.model,
          });
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

function runModel(
  folder: string,
  model: string,
  input: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((accept, reject) => {
    const child = spawn(
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
      {
        cwd: folder,
        env: Object.fromEntries(
          ["HOME", "PATH", "USER"].flatMap((name) =>
            process.env[name] === undefined ? [] : [[name, process.env[name]]],
          ),
        ),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let failure: DigestFailure | undefined;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const deadline = setTimeout(() => {
      stop(new DigestFailure("The model timed out"));
    }, TIMEOUT_MS);
    function stop(reason: DigestFailure) {
      if (failure) return;
      failure = reason;
      child.kill("SIGTERM");
      forceKill = setTimeout(() => {
        child.kill("SIGKILL");
      }, 2000);
    }
    function clearTimers() {
      clearTimeout(deadline);
      clearTimeout(forceKill);
    }
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let outputBytes = 0;
    function withinLimit(chunk: string): boolean {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > OUTPUT_LIMIT_BYTES) stop(new DigestFailure("The model output was too large"));
      return !failure;
    }
    child.stdout.on("data", (chunk: string) => {
      if (withinLimit(chunk)) stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      if (withinLimit(chunk)) stderr += chunk;
    });
    child.once("error", (cause) => {
      clearTimers();
      reject(cause);
    });
    child.once("close", (exitCode, signal) => {
      clearTimers();
      if (failure) {
        reject(failure);
        return;
      }
      if (exitCode === null) reject(new Error(`claude stopped with ${signal ?? "no exit code"}: ${stderr}`));
      else accept({ stdout, stderr, exitCode });
    });
    child.stdin.on("error", (cause: NodeJS.ErrnoException) => {
      if (cause.code !== "EPIPE") stop(new DigestFailure("Could not run the model", { cause }));
    });
    child.stdin.end(input);
  });
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
