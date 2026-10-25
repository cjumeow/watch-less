// Runs the worker's loop on a data folder with the fake steps, for checking a build of the loop by hand before its
// real steps exist, or without spending the subscription. Bundle it from a commit, then run it:
//
//   npx esbuild worker/scripts/run-with-fake-steps.ts --bundle --platform=node --format=esm --outfile=<out>.js
//   YT_DIGEST_DATA_DIR=<a temporary folder> node <out>.js '{"<videoId>": {"postponed": true}}'
//
// The argument says how the fake steps treat each video (see FakeVideo in src/fakes.ts); a video it leaves out
// succeeds. Each notification is printed instead of shown.

import { fakeSteps, type FakeVideo } from "../src/fakes.js";
import { runQueue } from "../src/run-queue.js";

const dataFolder = process.env.YT_DIGEST_DATA_DIR;
if (dataFolder === undefined || dataFolder === "") {
  throw new Error("Set YT_DIGEST_DATA_DIR to a temporary folder, so the check never touches the real queue");
}
const videos = JSON.parse(process.argv[2] ?? "{}") as Record<string, FakeVideo>;
const steps = fakeSteps(videos);

await runQueue({
  dataFolder,
  steps,
  notifier: {
    notify(title, text) {
      console.log(`notification: ${title} | ${text}`);
      return Promise.resolve();
    },
  },
});
console.log(`steps called: ${steps.calls.join(", ") || "none"}`);
