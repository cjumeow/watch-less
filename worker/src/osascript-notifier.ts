import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Notifier } from "./notifier.js";

// The title and the text are passed as arguments to the script, never written into it, since a video's title is
// someone else's text and would otherwise be AppleScript the worker runs.
const SCRIPT = ["on run argv", "display notification (item 2 of argv) with title (item 1 of argv)", "end run"];

// launchd never starts a second worker while one runs, so a hung osascript must not hang the worker with it.
const TIMEOUT_MS = 10_000;

/** Shows a macOS notification with `osascript`. Clicking it does nothing. */
export const osascriptNotifier: Notifier = {
  async notify(title, text) {
    await promisify(execFile)("osascript", [...SCRIPT.flatMap((line) => ["-e", line]), title, text], {
      timeout: TIMEOUT_MS,
    });
  },
};
