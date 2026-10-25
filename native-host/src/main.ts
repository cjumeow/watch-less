// The native host's entry point. Chrome starts it for each request, with the request framed on stdin, and reads the
// framed reply from stdout; the host exits after replying. Nothing else may be written to stdout, since Chrome reads
// every byte there as part of a reply.
import { homedir } from "node:os";
import { join } from "node:path";
import { runHost } from "./host.js";

// Tests and checks point the host at a temporary folder, never at the one the developer's requests are in.
const DATA_DIR_VARIABLE = "YT_DIGEST_DATA_DIR";

function dataDir(): string {
  const fromEnvironment = process.env[DATA_DIR_VARIABLE];
  if (fromEnvironment !== undefined && fromEnvironment !== "") return fromEnvironment;
  return join(homedir(), "Library", "Application Support", "yt-digest");
}

const reply = await runHost({ input: process.stdin, dataDir: dataDir(), now: () => new Date() });
process.stdout.write(reply, () => process.exit(0));
