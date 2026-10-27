import { spawn } from "node:child_process";
import { DigestFailure } from "../digest-failure.js";
import type { Delivered, Digest } from "./destination.js";

const TIMEOUT_MS = 90_000;

/** What `ntn pages create` takes on stdin: the digest with the video's link as a `<video>` block, which Notion embeds. */
export function toNotionMarkdown(digest: Digest): string {
  return digest.markdown.replace(`\n${digest.videoLink}\n`, `\n<video src="${digest.videoLink}"></video>\n`);
}

/** What `ntn` says when no login is stored; it is matched loosely because the CLI is in beta. */
const SIGNED_OUT = /not (?:logged|signed) in|ntn login|unauthori[sz]ed/i;

/** The arguments after `ntn`: a page inside the folder page when there is one, else the Private section. */
export function notionArguments(folderPage: string | undefined): string[] {
  return ["pages", "create", "--json", ...(folderPage === undefined ? [] : ["--parent", `page:${folderPage}`])];
}

/**
 * Creates a Notion page from the digest with Notion's CLI, signed in with `ntn login`. The Markdown goes on stdin,
 * which is always closed: `ntn` waits forever on a stdin that stays open. It runs with only `HOME`, `PATH` and `USER`,
 * enough to reach the keychain login from launchd.
 */
export async function deliverToNotion(digest: Digest): Promise<Delivered> {
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
  return pageLink(result.stdout);
}

/**
 * The created page's link from `ntn --json`'s answer, the API's page object: its `url`, or one built from its `id`.
 * The page is already created, so an answer that cannot be read only leaves the notification without a link.
 */
function pageLink(stdout: string): Delivered {
  let page: unknown;
  try {
    page = JSON.parse(stdout) as unknown;
  } catch {
    return {};
  }
  if (typeof page !== "object" || page === null) return {};
  if ("url" in page && typeof page.url === "string" && /^https:\/\/(?:www\.|app\.)?notion\.(?:so|com)\//.test(page.url))
    return { link: page.url };
  if ("id" in page && typeof page.id === "string" && /^[0-9a-f-]{32,36}$/i.test(page.id))
    return { link: `https://www.notion.so/${page.id.replaceAll("-", "")}` };
  return {};
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
