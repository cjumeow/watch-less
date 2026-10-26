import { DigestFailure } from "../digest-failure.js";
import type { ModelAnswer } from "./model-step.js";

/** Reads the CLI's answer, which must have each of `headings`, as written by `model`. */
export function readModelAnswer(
  stdout: string,
  exitCode: number,
  expected: { headings: readonly string[]; model: string },
): ModelAnswer {
  if (isUsageLimit(stdout)) return { outcome: "postponed" };
  let value: unknown;
  try {
    value = JSON.parse(stdout) as unknown;
  } catch (cause) {
    throw new DigestFailure("The model failed to write a digest", { cause });
  }
  if (typeof value !== "object" || value === null || !("result" in value) || typeof value.result !== "string") {
    throw new DigestFailure("The model failed to write a digest");
  }
  if (
    "type" in value &&
    value.type === "result" &&
    "is_error" in value &&
    value.is_error === true &&
    isUsageLimit(value.result)
  )
    return { outcome: "postponed" };
  if (
    exitCode !== 0 ||
    !("type" in value) ||
    value.type !== "result" ||
    !("subtype" in value) ||
    value.subtype !== "success" ||
    !("is_error" in value) ||
    value.is_error !== false
  )
    throw new DigestFailure("The model failed to write a digest");
  const lines = value.result.split(/\r?\n/).map((line) => line.trim());
  if (expected.headings.some((heading) => !lines.includes(heading)))
    throw new DigestFailure("The digest was incomplete");
  return { outcome: "written", sections: value.result, model: expected.model };
}

/** Matches the observed CLI message, never arbitrary text that merely mentions a limit. */
function isUsageLimit(text: string): boolean {
  return /^You've hit your (?:session )?limit · resets [^\r\n]+$/.test(text.trim());
}

/** Reads the answer Codex wrote with `--output-last-message`, which must have each of `headings`. */
export function readCodexAnswer(
  answer: string | undefined,
  exitCode: number,
  expected: { headings: readonly string[]; model: string },
): ModelAnswer {
  // Codex's usage-limit message is not confirmed, so it fails here like any other error.
  if (exitCode !== 0 || answer === undefined) throw new DigestFailure("The model failed to write a digest");
  const lines = answer.split(/\r?\n/).map((line) => line.trim());
  if (expected.headings.some((heading) => !lines.includes(heading)))
    throw new DigestFailure("The digest was incomplete");
  return { outcome: "written", sections: answer, model: expected.model };
}
