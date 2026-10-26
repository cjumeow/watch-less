// Runs setup.sh with made-up commands first on a PATH of their own, so each test decides which tools this "Mac" has
// and how they answer. Nothing here installs anything: a made-up brew and uv only record what they were asked.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(import.meta.dirname, "setup.sh");

let folder;
let bin;

/** A made-up command that prints `output`, on stderr when `toStderr`, exits with `code`, and records its arguments. */
function command(name, output = "", code = 0, toStderr = false) {
  const file = join(bin, name);
  writeFileSync(
    file,
    `#!/bin/sh\necho "${name} $*" >> "${join(folder, "calls")}"\nprintf '%s\\n' '${output}'${toStderr ? " >&2" : ""}\nexit ${String(code)}\n`,
  );
  chmodSync(file, 0o755);
}

/** Every tool, signed in to both plans. */
function everything() {
  command("node", "v24.18.0");
  command("yt-dlp", "2026.10.01");
  command("ffmpeg", "ffmpeg version 8.0");
  command("mlx_whisper", "usage: mlx_whisper");
  command("heptabase", "0.7.0");
  command("claude", '{ "loggedIn": true, "authMethod": "claude.ai" }');
  // As the real one does, codex login status prints to stderr.
  command("codex", "Logged in using ChatGPT", 0, true);
}

function setup(args = ["--check"], input = "") {
  try {
    const stdout = execFileSync("/bin/sh", [SCRIPT, ...args], {
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: folder },
      input,
      encoding: "utf8",
      stdio: "pipe",
    });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status, output: `${error.stdout}${error.stderr}` };
  }
}

function calls() {
  const file = join(folder, "calls");
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "setup-test-"));
  bin = join(folder, "bin");
  mkdirSync(bin);
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe("setup.sh --check", () => {
  it("passes when every tool is there and a plan is signed in", () => {
    everything();
    const { code, output } = setup();
    expect(code).toBe(0);
    expect(output).toContain("Ready");
  });

  it("fails without yt-dlp, and says how to install it", () => {
    everything();
    rmSync(join(bin, "yt-dlp"));
    const { code, output } = setup();
    expect(code).toBe(1);
    expect(output).toContain("brew install yt-dlp");
  });

  it("fails on a Node.js other than 24", () => {
    everything();
    command("node", "v22.11.0");
    const { code, output } = setup();
    expect(code).toBe(1);
    expect(output).toContain("Node.js 24");
  });

  it("fails without the Heptabase CLI, and says where to turn it on", () => {
    everything();
    rmSync(join(bin, "heptabase"));
    const { code, output } = setup();
    expect(code).toBe(1);
    expect(output).toContain("Heptabase");
  });

  it("fails when neither Claude Code nor Codex CLI is signed in", () => {
    everything();
    rmSync(join(bin, "codex"));
    command("claude", '{ "loggedIn": false }');
    const { code, output } = setup();
    expect(code).toBe(1);
    expect(output).toContain("claude auth login");
  });

  it("passes with only Codex CLI signed in with ChatGPT", () => {
    everything();
    rmSync(join(bin, "claude"));
    expect(setup().code).toBe(0);
  });

  it("does not count Claude Code signed in with an API key, which yt-digest never uses", () => {
    everything();
    rmSync(join(bin, "codex"));
    command("claude", '{ "loggedIn": true, "authMethod": "api_key" }');
    const { code, output } = setup();
    expect(code).toBe(1);
    expect(output).toContain("API key");
  });

  it("passes without ffmpeg and mlx_whisper, warning that videos without subtitles will fail", () => {
    everything();
    rmSync(join(bin, "ffmpeg"));
    rmSync(join(bin, "mlx_whisper"));
    const { code, output } = setup();
    expect(code).toBe(0);
    expect(output).toContain("without subtitles");
  });

  it("installs nothing", () => {
    everything();
    rmSync(join(bin, "yt-dlp"));
    command("brew");
    setup();
    expect(calls()).not.toContain("brew install");
  });
});

describe("setup.sh", () => {
  it("installs the missing Homebrew tools after the developer agrees", () => {
    everything();
    rmSync(join(bin, "yt-dlp"));
    rmSync(join(bin, "ffmpeg"));
    command("brew");
    setup([], "y\n");
    expect(calls()).toContain("brew install yt-dlp ffmpeg");
  });

  it("installs nothing when the developer declines", () => {
    everything();
    rmSync(join(bin, "yt-dlp"));
    command("brew");
    const { code } = setup([], "n\n");
    expect(calls()).not.toContain("brew install");
    expect(code).toBe(1);
  });

  it("installs mlx-whisper with uv after the developer agrees", () => {
    everything();
    rmSync(join(bin, "mlx_whisper"));
    command("uv");
    setup([], "y\n");
    expect(calls()).toContain("uv tool install mlx-whisper");
  });
});
