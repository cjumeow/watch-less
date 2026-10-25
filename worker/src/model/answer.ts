import { DigestFailure } from "../digest-failure.js";
import type { ModelAnswer } from "./model-step.js";

/** The model requested for every digest and recorded in its header. */
export const MODEL = "opus";

export function readModelAnswer(stdout: string, exitCode: number): ModelAnswer {
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
  const headings = ["## 結論", "## 主要論點", "## 參考資料", "## 評估"];
  const lines = value.result.split(/\r?\n/).map((line) => line.trim());
  if (headings.some((heading) => !lines.includes(heading))) throw new DigestFailure("The digest was incomplete");
  return { outcome: "written", sections: value.result, model: MODEL };
}

/** Matches the observed CLI message, never arbitrary text that merely mentions a limit. */
function isUsageLimit(text: string): boolean {
  return /^You've hit your (?:session )?limit · resets [^\r\n]+$/.test(text.trim());
}
