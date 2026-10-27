import { spawn } from "node:child_process";
import { DigestFailure } from "../digest-failure.js";
import type { Digest } from "./destination.js";

const TIMEOUT_MS = 90_000;

/** What `ntn pages create` takes on stdin: the digest with the video's link as a `<video>` block, which Notion embeds. */
export function toNotionMarkdown(digest: Digest): string {
  return digest.markdown.replace(`\n${digest.videoLink}\n`, `\n<video src="${digest.videoLink}"></video>\n`);
}

/** What `ntn` says when no login is stored; it is matched loosely because the CLI is in beta. */
const SIGNED_OUT = /not (?:logged|signed) in|ntn login|unauthori[sz]ed/i;

/** The arguments after `ntn`: a page inside the folder page when there is one, else the Private section. */
export function notionArguments(folderPage: string | undefined): string[] {
  return ["pages", "create", ...(folderPage === undefined ? [] : ["--parent", `page:${folderPage}`])];
}

/**
 * Creates a Notion page from the digest with Notion's CLI, signed in with `ntn login`. The Markdown goes on stdin,
 * which is always closed: `ntn` waits forever on a stdin that stays open. It runs with only `HOME`, `PATH` and `USER`,
 * enough to reach the keychain login from launchd.
 */
export async function deliverToNotion(digest: Digest): Promise<void> {
  const result = await runNtn(notionArguments(digest.notionFolderPage), toNotionMarkdown(digest));
  if (result === "missing") {
    throw new DigestFailure("Notion CLI is not installed: run sh scripts/setup.sh");
  }
  if (result.exitCode !== 0) {
    const reason = SIGNED_OUT.test(result.stderr + result.stdout)
      ? "Notion CLI is not signed in: run ntn login"
      : "Notion delivery failed";
    throw new DigestFailure(reason, {
      cause: new Error(`ntn exited with ${String(result.exitCode)}: ${result.stderr}`),
    });
  }
}

function runNtn(
  args: string[],
  input: string,
): Promise<"missing" | { exitCode: number; stdout: string; stderr: string }> {
  return new Promise((accept, reject) => {
    const child = spawn("ntn", args, {
      env: Object.fromEntries(
        ["HOME", "PATH", "USER"].flatMap((name) =>
          process.env[name] === undefined ? [] : [[name, process.env[name]]],
        ),
      ),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.once("error", (cause: NodeJS.ErrnoException) => {
      clearTimeout(deadline);
      if (cause.code === "ENOENT") accept("missing");
      else reject(new DigestFailure("Notion delivery failed", { cause }));
    });
    child.once("close", (exitCode) => {
      clearTimeout(deadline);
      if (timedOut) reject(new DigestFailure("Notion delivery timed out"));
      else accept({ exitCode: exitCode ?? 1, stdout, stderr });
    });
    // A closed pipe before all is written shows as the exit code, so this error is not a second report.
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}
