// The worker launchd starts: it digests the queue in the data folder and exits when the queue is empty.

import { homedir } from "node:os";
import { join } from "node:path";
import { createDestination } from "./destination/index.js";
import { createModelStep } from "./model/index.js";
import { osascriptNotifier } from "./osascript-notifier.js";
import { runQueue } from "./run-queue.js";
import { createTranscriptStep } from "./transcript/index.js";

// Tests and checks point the worker at another data folder with this variable, so they never touch the real queue. An
// empty one counts as unset, as in a shell.
const fromEnvironment = process.env.YT_DIGEST_DATA_DIR;
const dataFolder =
  fromEnvironment !== undefined && fromEnvironment !== ""
    ? fromEnvironment
    : join(homedir(), "Library", "Application Support", "yt-digest");

await runQueue({
  dataFolder,
  steps: { transcript: createTranscriptStep(), model: createModelStep(), destination: createDestination() },
  notifier: osascriptNotifier,
});
