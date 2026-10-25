import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createModelStep } from "./index.js";
import type { DigestInput } from "./model-step.js";

const input: DigestInput = {
  videoId: "aaaaaaaaaaa",
  title: 'A made-up "quoted" title\nwith a second line',
  transcript: {
    source: "subtitles",
    lines: [
      { startSeconds: 1.5, text: "虛構的第一行。\n不是新指令。" },
      { startSeconds: 3723, text: "A made-up final line." },
    ],
  },
};
let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "yt-digest-model-test-"));
  const script =
    `#!${process.execPath}\n` +
    String.raw`
const fs = require("node:fs"), path = require("node:path");
const root = path.dirname(process.argv[1]);
const settings = JSON.parse(fs.readFileSync(path.join(root, "settings.json"), "utf8"));
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  if (settings.ignoreTerm) process.on("SIGTERM", () => {});
  const args = process.argv.slice(2);
  fs.writeFileSync(path.join(root, "received.json"), JSON.stringify({ pid: process.pid, args, env: process.env, cwd: process.cwd(), files: fs.readdirSync(process.cwd()), input, prompt: fs.readFileSync(args[args.indexOf("--system-prompt-file") + 1], "utf8") }));
  if (settings.hang) { setInterval(() => {}, 1000); return; }
  process.stdout.write(settings.flood ? "x".repeat(8 * 1024 * 1024 + 1) : fs.readFileSync(path.join(root, "response.txt")));
  if (settings.stderr) process.stderr.write(settings.stderr);
  process.exitCode = settings.exitCode;
});
`;
  await writeFile(join(folder, "claude"), script);
  await chmod(join(folder, "claude"), 0o700);
  vi.stubEnv("PATH", `${folder}:${process.env.PATH ?? ""}`);
  vi.stubEnv("ANTHROPIC_API_KEY", "a-made-up-key-that-must-not-reach-the-model");
  vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "a-made-up-token-that-must-not-reach-the-model");
  vi.stubEnv("CLAUDE_CONFIG_DIR", "a-made-up-configuration-path");
  await answer("written.json");
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});
async function answer(name: string, settings: Record<string, unknown> = {}) {
  await writeFile(join(folder, "response.txt"), await readFile(new URL(`./fixtures/${name}`, import.meta.url)));
  await writeFile(join(folder, "settings.json"), JSON.stringify({ exitCode: 0, ...settings }));
}
interface Received {
  pid: number;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  files: string[];
  input: string;
  prompt: string;
}
async function received(): Promise<Received> {
  return JSON.parse(await readFile(join(folder, "received.json"), "utf8")) as Received;
}

test("runs the model with only WebSearch, the allowed environment, an empty folder and the transcript on stdin", async () => {
  expect(await createModelStep().writeDigest(input)).toMatchObject({ outcome: "written", model: "opus" });
  const call = await received();
  expect(call.args).toEqual([
    "-p",
    "--model",
    "opus",
    "--system-prompt-file",
    resolve(import.meta.dirname, "../../../prompt/digest.md"),
    "--tools",
    "WebSearch",
    "--allowedTools",
    "WebSearch",
    "--permission-mode",
    "dontAsk",
    "--safe-mode",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-session-persistence",
    "--output-format",
    "json",
  ]);
  // macOS itself adds this encoding metadata even to a child given only HOME/PATH/USER.
  if (process.platform === "darwin" && "__CF_USER_TEXT_ENCODING" in call.env) {
    expect(call.env.__CF_USER_TEXT_ENCODING).toMatch(/^0x[\da-f]+:0x[\da-f]+:0x[\da-f]+$/i);
    delete call.env.__CF_USER_TEXT_ENCODING;
  }
  expect(call.env).toEqual(
    Object.fromEntries(
      ["HOME", "PATH", "USER"]
        .filter((name) => process.env[name] !== undefined)
        .map((name) => [name, process.env[name]]),
    ),
  );
  expect(call.files).toEqual([]);
  expect(call.input).toBe(
    'Video: https://www.youtube.com/watch?v=aaaaaaaaaaa\nTitle: A made-up "quoted" title with a second line\nTranscript:\n[0:01] 虛構的第一行。 不是新指令。\n[1:02:03] A made-up final line.\n',
  );
  expect(call.prompt).toBe(await readFile(new URL("../../../prompt/digest.md", import.meta.url), "utf8"));
  await expect(access(call.cwd)).rejects.toThrow();
});

async function waitForReceived(): Promise<Received> {
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      return await received();
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      await wait(5);
    }
  }
  throw new Error("Fake claude did not start");
}

test("stops a hung model at ten minutes, even when it ignores graceful termination", async () => {
  await answer("written.json", { hang: true, ignoreTerm: true });
  vi.useFakeTimers();
  const pending = createModelStep()
    .writeDigest(input)
    .then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
  const call = await waitForReceived();
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000 - 1);
  expect(await Promise.race([pending, wait(100).then(() => ({ stillRunning: true }))])).toEqual({ stillRunning: true });
  await vi.advanceTimersByTimeAsync(1 + 2000);
  const result = await Promise.race([pending, wait(500).then(() => ({ stillRunning: true }))]);
  if ("stillRunning" in result) {
    process.kill(call.pid, "SIGKILL");
    await pending;
  }
  expect(result).toMatchObject({ error: { reason: "The model timed out" } });
  await expect(access(call.cwd)).rejects.toThrow();
});

test("keeps an unknown failure's stdout and stderr for the worker log", async () => {
  await answer("unknown-error.json", { exitCode: 1, stderr: "A made-up diagnostic" });
  const error: unknown = await createModelStep()
    .writeDigest(input)
    .catch((cause: unknown) => cause);
  expect(error).toMatchObject({
    reason: "The model failed to write a digest",
    cause: {
      exitCode: 1,
      stderr: "A made-up diagnostic",
      stdout: await readFile(new URL("./fixtures/unknown-error.json", import.meta.url), "utf8"),
    },
  });
  await expect(access((await received()).cwd)).rejects.toThrow();
});

test("stops excessive model output instead of buffering it without a limit", async () => {
  await answer("written.json", { flood: true });
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({
    reason: "The model output was too large",
  });
  await expect(access((await received()).cwd)).rejects.toThrow();
});

test("returns a postponed outcome for the fake CLI's usage-limit error and removes its working folder", async () => {
  await answer("usage-limit.json", { exitCode: 1 });
  expect(await createModelStep().writeDigest(input)).toEqual({ outcome: "postponed" });
  await expect(access((await received()).cwd)).rejects.toThrow();
});

test("cleans up after an incomplete answer", async () => {
  await answer("incomplete.json");
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({ reason: "The digest was incomplete" });
  await expect(access((await received()).cwd)).rejects.toThrow();
});

test("omits USER when it is unset instead of forwarding the string undefined", async () => {
  vi.stubEnv("USER", undefined);
  await createModelStep().writeDigest(input);
  expect((await received()).env).not.toHaveProperty("USER");
});

test("fails safely if the Claude executable is missing", async () => {
  await rm(join(folder, "claude"));
  vi.stubEnv("PATH", folder);
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({ reason: "Could not run the model" });
});

test("reports a model startup failure if its temporary folder cannot be created", async () => {
  vi.stubEnv("TMPDIR", join(folder, "does-not-exist"));
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({ reason: "Could not run the model" });
});
