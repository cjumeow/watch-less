import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DigestFailure } from "../digest-failure.js";
import type { Destination } from "./destination.js";
import { toHeptabaseMarkdown } from "./heptabase.js";
import { deliverToNotion } from "./notion.js";

export type * from "./destination.js";

const execute = promisify(execFile);

export function createDestination(): Destination {
  return {
    async deliver(digest) {
      if (digest.destination === "notion") return deliverToNotion(digest);
      const folder = await mkdtemp(join(tmpdir(), "yt-digest-delivery-"));
      let started = false;
      async function run(args: string[]): Promise<string> {
        try {
          return (await execute("heptabase", args, { timeout: 90_000 })).stdout;
        } catch (error) {
          const stderr = error instanceof Error && "stderr" in error ? String(error.stderr) : "";
          if (started || !stderr.includes("Heptabase CLI cannot connect to the desktop app.")) throw error;
          started = true;
          await execute("heptabase", ["start"], { timeout: 90_000 });
          return (await execute("heptabase", args, { timeout: 90_000 })).stdout;
        }
      }
      try {
        const contentFile = join(folder, "digest.md");
        await writeFile(contentFile, toHeptabaseMarkdown(digest), { mode: 0o600 });
        const stdout = await run(["note", "create", "--content-file", contentFile]);
        const note: unknown = JSON.parse(stdout);
        if (
          typeof note !== "object" ||
          note === null ||
          !("id" in note) ||
          typeof note.id !== "string" ||
          !note.id.trim()
        ) {
          throw new Error("Heptabase did not return a note id");
        }
        await run(["tag", "add", "--card-id", note.id, "--tag-name", "yt-digest"]);
      } catch (cause) {
        throw new DigestFailure("Heptabase delivery failed", { cause });
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
    },
  };
}
