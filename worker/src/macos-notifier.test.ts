import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { macosNotifier } from "./macos-notifier.js";

let folder: string;

/** A made-up command on PATH that records its arguments, and exits with `code`. */
async function command(name: string, code = 0) {
  const file = join(folder, name);
  await writeFile(
    file,
    `#!${process.execPath}\nrequire("node:fs").appendFileSync(${JSON.stringify(join(folder, "calls.jsonl"))}, JSON.stringify([${JSON.stringify(name)}, ...process.argv.slice(2)]) + "\\n");\nprocess.exit(${String(code)});\n`,
  );
  await chmod(file, 0o700);
}

async function calls(): Promise<string[][]> {
  const text = await readFile(join(folder, "calls.jsonl"), "utf8").catch(() => "");
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "yt-digest-notifier-"));
  vi.stubEnv("PATH", folder);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});

test("shows the result with terminal-notifier, opening the digest's page when clicked", async () => {
  await command("terminal-notifier");
  await macosNotifier.notify(
    "Digest ready",
    "A made-up video",
    "heptabase://card/11111111-1111-4111-8111-111111111111",
  );
  expect(await calls()).toEqual([
    [
      "terminal-notifier",
      "-title",
      "yt-digest",
      "-subtitle",
      "Digest ready",
      "-message",
      "A made-up video",
      "-open",
      "heptabase://card/11111111-1111-4111-8111-111111111111",
    ],
  ]);
});

test("shows a failure without a link", async () => {
  await command("terminal-notifier");
  await macosNotifier.notify("Digest failed", "A made-up video: No transcript available");
  expect(await calls()).toEqual([
    [
      "terminal-notifier",
      "-title",
      "yt-digest",
      "-subtitle",
      "Digest failed",
      "-message",
      "A made-up video: No transcript available",
    ],
  ]);
});

test("falls back to osascript when terminal-notifier is not installed", async () => {
  await command("osascript");
  await macosNotifier.notify(
    "Digest ready",
    "A made-up video",
    "https://www.notion.so/0123456789abcdef0123456789abcdef",
  );
  const [call] = await calls();
  expect(call?.[0]).toBe("osascript");
  expect(call?.slice(-2)).toEqual(["Digest ready", "A made-up video"]);
});

test("falls back to osascript when terminal-notifier fails, as when notifications are not allowed", async () => {
  await command("terminal-notifier", 1);
  await command("osascript");
  await macosNotifier.notify("Digest ready", "A made-up video");
  expect((await calls()).map((call) => call[0])).toEqual(["terminal-notifier", "osascript"]);
});

test("keeps a title that starts with a hyphen as the message, not an option", async () => {
  await command("terminal-notifier");
  await macosNotifier.notify("Digest ready", "-open https://example.com");
  expect((await calls())[0]).toContain("\u2011open https://example.com");
});
