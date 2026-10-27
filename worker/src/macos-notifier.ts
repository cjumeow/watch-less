import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Notifier } from "./notifier.js";

const execute = promisify(execFile);

// launchd never starts a second worker while one runs, so a hung notifier must not hang the worker with it.
const TIMEOUT_MS = 10_000;

// The title and the text are passed as arguments to the script, never written into it, since a video's title is
// someone else's text and would otherwise be AppleScript the worker runs.
const SCRIPT = ["on run argv", "display notification (item 2 of argv) with title (item 1 of argv)", "end run"];

/**
 * terminal-notifier reads an argument that starts with a hyphen as one of its options, so a title such as
 * `-open https://…` would set where the notification leads. A leading hyphen becomes a non-breaking hyphen, which
 * looks the same.
 */
function asValue(text: string): string {
  return text.replace(/^-/, "‑");
}

/**
 * Shows a digest's result as a macOS notification. With terminal-notifier, clicking it opens the digest's page in
 * Heptabase or Notion; without it, or when macOS refuses it, `osascript` shows it, and clicking does nothing.
 */
export const macosNotifier: Notifier = {
  async notify(title, text, link) {
    try {
      await execute(
        "terminal-notifier",
        [
          "-title",
          "yt-digest",
          "-subtitle",
          title,
          "-message",
          asValue(text),
          ...(link === undefined ? [] : ["-open", link]),
        ],
        { timeout: TIMEOUT_MS },
      );
    } catch {
      await execute("osascript", [...SCRIPT.flatMap((line) => ["-e", line]), title, text], { timeout: TIMEOUT_MS });
    }
  },
};
