import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "./run-command.js";

/**
 * The Codex features that give a model tools the digest does not need. Codex has no switch for "no tools" as
 * `claude --tools ""` is, so these are turned off one by one and the read-only sandbox bounds what is left.
 */
const DISABLED_FEATURES = [
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
];

/**
 * Runs `codex exec` for the digest. `parent` is an empty temporary folder: the model works in `parent/work`, which
 * stays empty, and Codex writes its final message to `parent/answer.txt`, outside the folder the model can see.
 */
export async function runCodex(
  parent: string,
  model: string,
  promptFile: string,
  input: string,
): Promise<{ tool: "codex"; stdout: string; stderr: string; exitCode: number; answer: string | undefined }> {
  const work = join(parent, "work");
  const answerFile = join(parent, "answer.txt");
  await mkdir(work);
  const result = await runCommand(
    "codex",
    [
      "exec",
      "--model",
      model,
      // Commands the model could run cannot write, and the sandbox has no network.
      "--sandbox",
      "read-only",
      // The developer's own configuration, rules and saved sessions; the ChatGPT login stays.
      "--ignore-user-config",
      "--ignore-rules",
      "--ephemeral",
      "--skip-git-repo-check",
      "--cd",
      work,
      // The digest prompt replaces Codex's built-in instructions, as `--system-prompt-file` does for Claude.
      "-c",
      `model_instructions_file=${JSON.stringify(promptFile)}`,
      "-c",
      'approval_policy="never"',
      "-c",
      'web_search="disabled"',
      "-c",
      "mcp_servers={}",
      ...DISABLED_FEATURES.flatMap((feature) => ["--disable", feature]),
      "--output-last-message",
      answerFile,
      // The input is read from stdin.
      "-",
    ],
    work,
    input,
  );
  const answer = await readFile(answerFile, "utf8").catch(() => undefined);
  return { tool: "codex", ...result, answer };
}
