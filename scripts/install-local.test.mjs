// Runs install-local.sh's dry run in a made-up checkout: a git repository whose build writes stand-in programs, with
// the real templates for Chrome's manifest and the launchd agent. The dry run installs into a temporary home it makes
// under TMPDIR and never runs launchctl, so nothing here touches this computer's Chrome or launchd.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repository = join(import.meta.dirname, "..");
// The ID Chrome gave the extension loaded with the key in extension/manifest.json.
const EXTENSION_ID = "cfblilbnkpdfadellmkpijlbmacfeico";

// A build that writes one file per program, holding the prompt it was built with.
const BUILD = `
const fs = require("node:fs");
const write = (file, text) => { fs.mkdirSync(require("node:path").dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
write("native-host/dist/host.js", "// host\\n");
write("worker/dist/worker.js", "// worker\\n");
write("extension/dist/manifest.json", fs.readFileSync("extension/manifest.json", "utf8"));
write("extension/dist/content.js", "// content\\n");
`;

let folder;
let checkout;
let temporary;
let fakeBin;

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function git(...args) {
  execFileSync("git", args, { cwd: checkout, stdio: "pipe" });
}

beforeEach(() => {
  folder = realpathSync(mkdtempSync(join(tmpdir(), "install-local-test-")));
  checkout = join(folder, "checkout");
  temporary = join(folder, "tmp");
  fakeBin = join(folder, "bin");
  mkdirSync(temporary);

  write(
    join(checkout, "package.json"),
    JSON.stringify({ name: "made-up", private: true, scripts: { build: "node build.cjs" } }),
  );
  write(
    join(checkout, "package-lock.json"),
    JSON.stringify({ name: "made-up", lockfileVersion: 3, requires: true, packages: { "": { name: "made-up" } } }),
  );
  write(join(checkout, "build.cjs"), BUILD);
  const key = JSON.parse(readFileSync(join(repository, "extension/manifest.json"), "utf8")).key;
  write(join(checkout, "extension/manifest.json"), JSON.stringify({ name: "made-up", key }));
  write(join(checkout, "prompt/digest.md"), "The committed prompt.\n");
  for (const file of [
    "scripts/install-local.sh",
    "native-host/manifest.template.json",
    "worker/launchd/local.yt-digest.worker.plist",
  ]) {
    mkdirSync(dirname(join(checkout, file)), { recursive: true });
    copyFileSync(join(repository, file), join(checkout, file));
  }
  git("init", "--quiet");
  git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "made-up");

  // A launchctl that records being called, first on PATH, so a dry run that ran it would leave a trace.
  write(join(fakeBin, "launchctl"), `#!/bin/sh\necho "$@" >> '${join(folder, "launchctl-calls")}'\n`);
  chmodSync(join(fakeBin, "launchctl"), 0o755);
});

afterEach(() => {
  execFileSync("rm", ["-rf", folder]);
});

/** Runs the dry run and returns the temporary home it installed into. */
function dryRun() {
  // npm's own variables from the run that started Vitest would steer the npm the script runs.
  const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^npm_/i.test(name)));
  execFileSync("sh", [join(checkout, "scripts/install-local.sh"), "--dry-run"], {
    cwd: checkout,
    env: {
      ...environment,
      TMPDIR: temporary,
      PATH: `${fakeBin}:${join(checkout, "node_modules/.bin")}:${process.env.PATH}`,
    },
    stdio: "pipe",
  });
  const homes = readdirSync(temporary).filter((name) => name.startsWith("yt-digest-dry-run."));
  expect(homes).toHaveLength(1);
  return join(temporary, homes[0]);
}

const appIn = (home) => join(home, "Library/Application Support/yt-digest/app");

// Each run installs dependencies and builds, which takes seconds on a slow runner.
describe("install-local.sh --dry-run", { timeout: 30_000 }, () => {
  it("installs the programs built from the commit into the app folder of a temporary home", () => {
    write(join(checkout, "prompt/digest.md"), "An uncommitted edit.\n");

    const app = appIn(dryRun());

    expect(readFileSync(join(app, "native-host/dist/host.js"), "utf8")).toBe("// host\n");
    expect(readFileSync(join(app, "worker/dist/worker.js"), "utf8")).toBe("// worker\n");
    expect(readFileSync(join(app, "extension/dist/content.js"), "utf8")).toBe("// content\n");
    expect(readFileSync(join(app, "prompt/digest.md"), "utf8")).toBe("The committed prompt.\n");
  });

  it("registers a launcher in the app folder that runs the installed host, for the extension's ID only", () => {
    const home = dryRun();
    const app = appIn(home);

    const manifest = JSON.parse(
      readFileSync(
        join(home, "Library/Application Support/Google/Chrome/NativeMessagingHosts/com.yt_digest.host.json"),
      ),
    );
    expect(manifest.path).toBe(join(app, "native-host/yt-digest-host"));
    expect(manifest.allowed_origins).toEqual([`chrome-extension://${EXTENSION_ID}/`]);
    const launcher = readFileSync(manifest.path, "utf8");
    expect(launcher).toContain(`'${join(app, "native-host/dist/host.js")}' "$@"`);
    expect(statSync(manifest.path).mode & 0o111).not.toBe(0);
  });

  it("writes the worker's launchd agent for the installed worker, with no folder of the checkout on its PATH", () => {
    const home = dryRun();
    const data = join(home, "Library/Application Support/yt-digest");

    const plist = readFileSync(join(home, "Library/LaunchAgents/local.yt-digest.worker.plist"), "utf8");
    expect(plist).toContain(`<string>${join(data, "app/worker/dist/worker.js")}</string>`);
    expect(plist).toContain(`<string>${join(data, "queue")}</string>`);
    const path = plist.match(/<key>PATH<\/key>\s*<string>(.*)<\/string>/)[1];
    expect(path.split(":")).toContain(fakeBin);
    expect(path).not.toContain(checkout);
  });

  it("runs no launchctl", () => {
    dryRun();

    expect(existsSync(join(folder, "launchctl-calls"))).toBe(false);
  });

  it("leaves no path into the checkout in anything it installs", () => {
    const home = dryRun();

    const files = readdirSync(home, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(join(file.parentPath, file.name), "utf8"), file.name).not.toContain(checkout);
    }
  });
});
