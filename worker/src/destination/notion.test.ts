import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DigestFailure } from "../digest-failure.js";
import { createDestination } from "./index.js";
import { toNotionMarkdown } from "./notion.js";

const digest = {
  destination: "notion",
  videoLink: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
  markdown:
    "# 虛構影片\n\nhttps://www.youtube.com/watch?v=aaaaaaaaaaa\n\n## 結論\n參見 [影片](https://www.youtube.com/watch?v=aaaaaaaaaaa)。\n",
} as const;

test("makes the header's video link a video block and keeps the title and the model's sections", () => {
  expect(toNotionMarkdown(digest)).toBe(
    '# 虛構影片\n\n<video src="https://www.youtube.com/watch?v=aaaaaaaaaaa"></video>\n\n## 結論\n參見 [影片](https://www.youtube.com/watch?v=aaaaaaaaaaa)。\n',
  );
});

let folder: string;

// A fake ntn that records its arguments and what it reads from stdin until it closes, as the real one reads its
// Markdown; the worker passes it only HOME, PATH and USER, so it finds its folder from its own path. An open stdin would hang this fake as it hangs the real one.
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "yt-digest-notion-"));
  const executable = join(folder, "ntn");
  await writeFile(
    executable,
    `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const folder = path.dirname(process.argv[1]);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  fs.writeFileSync(path.join(folder, "call.json"), JSON.stringify({ args: process.argv.slice(2), input, env: Object.keys(process.env).sort() }));
  const modeFile = path.join(folder, "mode");
  const mode = fs.existsSync(modeFile) ? fs.readFileSync(modeFile, "utf8") : "";
  if (mode === "signed-out") { console.error("Error: not logged in. Run ntn login."); process.exit(1); }
  if (mode === "failure") { console.error("Error: A made-up failure"); process.exit(1); }
  console.log("{}");
});
`,
  );
  await chmod(executable, 0o700);
  vi.stubEnv("PATH", `${folder}:${process.env.PATH ?? ""}`);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});

async function call(): Promise<{ args: string[]; input: string; env: string[] }> {
  return JSON.parse(await readFile(join(folder, "call.json"), "utf8")) as {
    args: string[];
    input: string;
    env: string[];
  };
}

async function failure(): Promise<DigestFailure> {
  const error: unknown = await createDestination()
    .deliver(digest)
    .catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(DigestFailure);
  return error as DigestFailure;
}

test("creates a page in the Private section: no --parent, the Markdown on stdin", async () => {
  await createDestination().deliver(digest);
  expect(await call()).toMatchObject({ args: ["pages", "create"], input: toNotionMarkdown(digest) });
});

test("creates the page inside the folder page when there is one", async () => {
  const notionFolderPage = "0123456789abcdef0123456789abcdef";
  await createDestination().deliver({ ...digest, notionFolderPage });
  expect(await call()).toMatchObject({
    args: ["pages", "create", "--parent", `page:${notionFolderPage}`],
    input: toNotionMarkdown(digest),
  });
});

test("runs ntn with only HOME, PATH and USER from the environment, as launchd does", async () => {
  vi.stubEnv("SOME_OTHER_SECRET", "x");
  await createDestination().deliver(digest);
  expect((await call()).env.filter((name) => ["HOME", "PATH", "USER", "SOME_OTHER_SECRET"].includes(name))).toEqual([
    "HOME",
    "PATH",
    "USER",
  ]);
});

test("reports a signed-out ntn with the command that fixes it", async () => {
  await writeFile(join(folder, "mode"), "signed-out");
  expect((await failure()).reason).toBe("Notion CLI is not signed in: run ntn login");
});

test("reports any other failure of ntn, keeping its message as the cause", async () => {
  await writeFile(join(folder, "mode"), "failure");
  const error = await failure();
  expect(error.reason).toBe("Notion delivery failed");
  expect(String(error.cause)).toContain("A made-up failure");
});

test("reports a missing ntn", async () => {
  vi.stubEnv("PATH", "/nonexistent");
  expect((await failure()).reason).toBe("Notion CLI is not installed: run sh scripts/setup.sh");
});
