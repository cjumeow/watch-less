import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createModelStep } from "./index.js";
import type { DigestInput } from "./model-step.js";

const input: DigestInput = {
  videoId: "aaaaaaaaaaa",
  title: "A made-up title",
  description: "",
  transcript: { source: "subtitles", lines: [{ startSeconds: 1, text: "A made-up line." }] },
  language: "en",
  model: "gpt-6-luna",
};
const written = "## Conclusion\nA.\n\n## Main arguments\n1. B.\n\n## References\n- C.\n";
let folder: string;

// A fake `codex` that records what it was given and writes the answer where `--output-last-message` says.
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "yt-digest-codex-test-"));
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
  const option = (name) => args[args.indexOf(name) + 1];
  const config = args.flatMap((arg, i) => arg === "-c" ? [args[i + 1]] : []);
  const modelInstructions = config.find(c => c.startsWith("model_instructions_file="));
  const instructionsPath = modelInstructions ? JSON.parse(modelInstructions.slice(modelInstructions.indexOf("=") + 1)) : undefined;
  fs.writeFileSync(path.join(root, "received.json"), JSON.stringify({
    pid: process.pid, args, env: process.env, cwd: process.cwd(), files: fs.readdirSync(process.cwd()), input,
    instructions: instructionsPath ? fs.readFileSync(instructionsPath, "utf8") : undefined,
  }));
  if (settings.hang) { setInterval(() => {}, 1000); return; }
  if (settings.flood) { process.stdout.write("x".repeat(8 * 1024 * 1024 + 1)); return; }
  if (settings.answer !== null) fs.writeFileSync(option("--output-last-message"), settings.answer);
  process.stdout.write(settings.answer ?? "");
  if (settings.stderr) process.stderr.write(settings.stderr);
  process.exitCode = settings.exitCode;
});
`;
  await writeFile(join(folder, "codex"), script);
  await chmod(join(folder, "codex"), 0o700);
  vi.stubEnv("PATH", `${folder}:${process.env.PATH ?? ""}`);
  vi.stubEnv("OPENAI_API_KEY", "a-made-up-key-that-must-not-reach-the-model");
  vi.stubEnv("CODEX_API_KEY", "a-made-up-key-that-must-not-reach-the-model");
  vi.stubEnv("CODEX_HOME", "a-made-up-configuration-path");
  await reply({});
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await rm(folder, { recursive: true, force: true });
});
async function reply(settings: Record<string, unknown>) {
  await writeFile(join(folder, "settings.json"), JSON.stringify({ exitCode: 0, answer: written, ...settings }));
}
interface Received {
  pid: number;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  files: string[];
  input: string;
  instructions: string;
}
async function received(): Promise<Received> {
  return JSON.parse(await readFile(join(folder, "received.json"), "utf8")) as Received;
}
async function gone(path: string) {
  await expect(access(path)).rejects.toThrow();
}

test("runs codex exec read-only, with no user configuration, the digest prompt as instructions and the input on stdin", async () => {
  expect(await createModelStep().writeDigest(input)).toEqual({
    outcome: "written",
    sections: written,
    model: "gpt-6-luna",
  });
  const call = await received();
  const answerFile = call.args[call.args.indexOf("--output-last-message") + 1] ?? "";
  const promptFile = resolve(import.meta.dirname, "../../../prompt/digest.md");
  const workFolder = call.args[call.args.indexOf("--cd") + 1] ?? "";
  expect(workFolder.endsWith("/work")).toBe(true);
  expect(call.cwd.endsWith("/work")).toBe(true);
  expect(call.args).toEqual([
    "exec",
    "--model",
    "gpt-6-luna",
    "--sandbox",
    "read-only",
    "--ignore-user-config",
    "--ignore-rules",
    "--ephemeral",
    "--skip-git-repo-check",
    "--cd",
    workFolder,
    "-c",
    `model_instructions_file=${JSON.stringify(promptFile)}`,
    "-c",
    'approval_policy="never"',
    "-c",
    'web_search="disabled"',
    "-c",
    "mcp_servers={}",
    ...[
      "shell_tool",
      "unified_exec",
      "apps",
      "plugins",
      "hooks",
      "multi_agent",
      "view_image",
      "image_generation",
      "computer_use",
      "browser_use",
    ].flatMap((feature) => ["--disable", feature]),
    "--output-last-message",
    answerFile,
    "-",
  ]);
  // The answer file sits beside the working folder, never in it.
  expect(dirname(answerFile)).toBe(dirname(workFolder));
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
  expect(call.input).toMatch(
    /^Video: https:\/\/www\.youtube\.com\/watch\?v=aaaaaaaaaaa\nLanguage: English\nHeadings: ## Conclusion \| ## Main arguments \| ## References\nMain arguments: 2\nTitle: A made-up title\nDescription:\nTranscript:\n\[0:01\] A made-up line\.\n$/,
  );
  expect(call.instructions).toBe(await readFile(promptFile, "utf8"));
  await gone(workFolder);
  await gone(dirname(answerFile));
});

test("does not run claude for an OpenAI model", async () => {
  await writeFile(join(folder, "claude"), "#!/bin/sh\ntouch " + join(folder, "claude-ran") + "\nexit 1\n");
  await chmod(join(folder, "claude"), 0o700);
  await createModelStep().writeDigest(input);
  await gone(join(folder, "claude-ran"));
});

test("checks the headings of the digest's language", async () => {
  await expect(createModelStep().writeDigest({ ...input, language: "ja" })).rejects.toMatchObject({
    reason: "The digest was incomplete",
  });
});

test("fails an incomplete answer and removes its folders", async () => {
  await reply({ answer: "## Conclusion\nOnly this.\n" });
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({ reason: "The digest was incomplete" });
  await gone((await received()).cwd);
});

test("fails when codex exits with an error, keeping its output for the worker log", async () => {
  await reply({ exitCode: 1, answer: null, stderr: "A made-up diagnostic" });
  const error: unknown = await createModelStep()
    .writeDigest(input)
    .catch((cause: unknown) => cause);
  expect(error).toMatchObject({
    reason: "The model failed to write a digest",
    cause: { exitCode: 1, stderr: "A made-up diagnostic" },
  });
  await gone((await received()).cwd);
});

test("fails an answer written despite a failing exit code", async () => {
  await reply({ exitCode: 1 });
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({
    reason: "The model failed to write a digest",
  });
});

test("fails when codex writes no answer", async () => {
  await reply({ answer: null });
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({
    reason: "The model failed to write a digest",
  });
});

test("treats a usage-limit message as a failure, since Codex's wording is not confirmed", async () => {
  await reply({ exitCode: 1, answer: null, stderr: "You've hit your usage limit. Try again at 3:09 PM." });
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({
    reason: "The model failed to write a digest",
  });
});

test("stops excessive output", async () => {
  await reply({ flood: true });
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({
    reason: "The model output was too large",
  });
  await gone((await received()).cwd);
});

test("stops a hung codex at ten minutes, even when it ignores graceful termination", async () => {
  await reply({ hang: true, ignoreTerm: true });
  vi.useFakeTimers();
  const pending = createModelStep()
    .writeDigest(input)
    .then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
  let call: Received | undefined;
  for (let attempt = 0; attempt < 200 && !call; attempt++) {
    call = await received().catch(() => undefined);
    if (!call) await wait(5);
  }
  if (!call) throw new Error("Fake codex did not start");
  await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 2000);
  const result = await Promise.race([pending, wait(500).then(() => ({ stillRunning: true }))]);
  if ("stillRunning" in result) {
    process.kill(call.pid, "SIGKILL");
    await pending;
  }
  expect(result).toMatchObject({ error: { reason: "The model timed out" } });
  await gone(call.cwd);
});

test("fails safely if the codex executable is missing", async () => {
  await rm(join(folder, "codex"));
  vi.stubEnv("PATH", folder);
  await expect(createModelStep().writeDigest(input)).rejects.toMatchObject({ reason: "Could not run the model" });
});
