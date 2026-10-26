import { spawn } from "node:child_process";
import { DigestFailure } from "../digest-failure.js";

const OUTPUT_LIMIT_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Runs a model's command-line tool in `folder` with only `HOME`, `PATH` and `USER` in its environment and `input` on
 * stdin, for at most ten minutes and 8 MiB of output.
 */
export function runCommand(
  command: string,
  args: string[],
  folder: string,
  input: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, {
      cwd: folder,
      env: Object.fromEntries(
        ["HOME", "PATH", "USER"].flatMap((name) =>
          process.env[name] === undefined ? [] : [[name, process.env[name]]],
        ),
      ),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let failure: DigestFailure | undefined;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const deadline = setTimeout(() => {
      stop(new DigestFailure("The model timed out"));
    }, TIMEOUT_MS);
    function stop(reason: DigestFailure) {
      if (failure) return;
      failure = reason;
      child.kill("SIGTERM");
      forceKill = setTimeout(() => {
        child.kill("SIGKILL");
      }, 2000);
    }
    function clearTimers() {
      clearTimeout(deadline);
      clearTimeout(forceKill);
    }
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let outputBytes = 0;
    function withinLimit(chunk: string): boolean {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > OUTPUT_LIMIT_BYTES) stop(new DigestFailure("The model output was too large"));
      return !failure;
    }
    child.stdout.on("data", (chunk: string) => {
      if (withinLimit(chunk)) stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      if (withinLimit(chunk)) stderr += chunk;
    });
    child.once("error", (cause) => {
      clearTimers();
      reject(cause);
    });
    child.once("close", (exitCode, signal) => {
      clearTimers();
      if (failure) {
        reject(failure);
        return;
      }
      if (exitCode === null) reject(new Error(`${command} stopped with ${signal ?? "no exit code"}: ${stderr}`));
      else accept({ stdout, stderr, exitCode });
    });
    child.stdin.on("error", (cause: NodeJS.ErrnoException) => {
      if (cause.code !== "EPIPE") stop(new DigestFailure("Could not run the model", { cause }));
    });
    child.stdin.end(input);
  });
}
