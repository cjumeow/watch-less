import { chmod, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DigestFailure } from "../digest-failure.js";
import { createDestination } from "./index.js";
import { toHeptabaseMarkdown } from "./heptabase.js";

const digest = {
  destination: "heptabase",
  videoLink: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
  markdown:
    "# 虛構影片\n\nhttps://www.youtube.com/watch?v=aaaaaaaaaaa\n\n## 結論\n參見 [影片](https://www.youtube.com/watch?v=aaaaaaaaaaa)。\n",
} as const;

test("embeds the header video link while preserving the title and model sections", () => {
  expect(toHeptabaseMarkdown(digest)).toBe(
    "# 虛構影片\n\n{{youtube https://www.youtube.com/watch?v=aaaaaaaaaaa}}\n\n## 結論\n參見 [影片](https://www.youtube.com/watch?v=aaaaaaaaaaa)。\n",
  );
});

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "yt-digest-heptabase-"));
  const executable = join(folder, "heptabase");
  await writeFile(
    executable,
    `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const folder = process.env.FAKE_HEPTABASE_FOLDER;
const log = path.join(folder, "calls.jsonl");
const calls = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\\n").map(JSON.parse) : [];
fs.appendFileSync(log, JSON.stringify(args) + "\\n");
const mode = process.env.FAKE_HEPTABASE_MODE;
if (mode === "create-failure" && args[0] === "note" || mode === "tag-failure" && args[0] === "tag" || mode === "start-failure" && args[0] === "start") {
  console.error(JSON.stringify({ error: "A made-up CLI failure" }));
  process.exit(1);
}
if ((mode === "not-running" || mode === "start-failure" || mode === "still-unavailable") && args[0] === "note" && (mode === "still-unavailable" || !calls.some(call => call[0] === "start"))) {
  console.error(JSON.stringify({ error: 'Heptabase CLI cannot connect to the desktop app. Run "heptabase start" first (or open Heptabase), enable CLI in Settings > AI Features, and retry.' }));
  process.exit(1);
}
if (mode === "tag-not-running" && args[0] === "tag" && !calls.some(call => call[0] === "start")) {
  console.error(JSON.stringify({ error: "Heptabase CLI cannot connect to the desktop app." }));
  process.exit(1);
}
if (args[0] === "note") {
  if (mode === "invalid-note") { console.log("{}"); process.exit(0); }
  fs.copyFileSync(args[3], path.join(folder, "received.md"));
  console.log(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", title: "虛構影片" }));
} else { console.log("{}"); }
`,
  );
  await chmod(executable, 0o700);
  vi.stubEnv("PATH", `${folder}:${process.env.PATH ?? ""}`);
  vi.stubEnv("FAKE_HEPTABASE_FOLDER", folder);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});

async function calls(): Promise<string[][]> {
  return (await readFile(join(folder, "calls.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as string[]);
}

test("delivers an embedded digest and tags the created note, keeping the AI mark", async () => {
  expect(await createDestination().deliver(digest)).toEqual({
    link: "heptabase://card/11111111-1111-4111-8111-111111111111",
  });

  const receivedCalls = await calls();
  expect(receivedCalls).toEqual([
    ["note", "create", "--content-file", expect.any(String)],
    ["tag", "add", "--card-id", "11111111-1111-4111-8111-111111111111", "--tag-name", "yt-digest"],
  ]);
  expect(await readFile(join(folder, "received.md"), "utf8")).toBe(toHeptabaseMarkdown(digest));
  await expect(access(receivedCalls[0]?.[3] ?? "missing-content-file")).rejects.toThrow();
});

test("starts Heptabase once when it is unavailable, then retries delivery", async () => {
  vi.stubEnv("FAKE_HEPTABASE_MODE", "not-running");
  await createDestination().deliver(digest);
  expect((await calls()).map((args) => args.slice(0, 2))).toEqual([
    ["note", "create"],
    ["start"],
    ["note", "create"],
    ["tag", "add"],
  ]);
});

test.each([
  ["create-failure", [["note", "create"]]],
  [
    "tag-failure",
    [
      ["note", "create"],
      ["tag", "add"],
    ],
  ],
  ["start-failure", [["note", "create"], ["start"]]],
  ["still-unavailable", [["note", "create"], ["start"], ["note", "create"]]],
])("reports a delivery reason for %s without an endless retry", async (mode, expectedCalls) => {
  vi.stubEnv("FAKE_HEPTABASE_MODE", mode);
  const failure: unknown = await createDestination()
    .deliver(digest)
    .catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(DigestFailure);
  if (!(failure instanceof DigestFailure)) throw new Error("Expected a DigestFailure");
  expect(failure.reason).toBe("Heptabase delivery failed");
  expect(failure.cause).toBeInstanceOf(Error);
  const receivedCalls = await calls();
  expect(receivedCalls.map((args) => args.slice(0, 2))).toEqual(expectedCalls);
  await expect(access(receivedCalls[0]?.[3] ?? "missing-content-file")).rejects.toThrow();
});

test("rejects a missing note id before attempting to tag", async () => {
  vi.stubEnv("FAKE_HEPTABASE_MODE", "invalid-note");
  await expect(createDestination().deliver(digest)).rejects.toMatchObject({ reason: "Heptabase delivery failed" });
  expect((await calls()).map((args) => args.slice(0, 2))).toEqual([["note", "create"]]);
});

test("retries only the tag after a connection failure, without creating a second note", async () => {
  vi.stubEnv("FAKE_HEPTABASE_MODE", "tag-not-running");
  await createDestination().deliver(digest);
  expect((await calls()).map((args) => args.slice(0, 2))).toEqual([
    ["note", "create"],
    ["tag", "add"],
    ["start"],
    ["tag", "add"],
  ]);
});
