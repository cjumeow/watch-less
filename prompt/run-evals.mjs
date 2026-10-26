// Runs the digest prompt on the made-up transcripts in prompt/evals/ with real `claude -p`, isolated as docs/spec.md
// "Running the model" says, and saves each digest under artifacts/<branch>/digests/ to compare against
// prompt/evals/CHECKLIST.md. Every run spends the developer's Claude subscription, so nothing runs without --run, not
// even when the script is imported or started by mistake. --check repeats the checks on saved runs and spends nothing.
//
//     node prompt/run-evals.mjs --run [<eval-name>...]
//     node prompt/run-evals.mjs --check <folder of saved runs>

import { execFileSync, spawn } from "node:child_process";
import console from "node:console";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** The three section headings, in order, of English, the language the evaluations ask for. The worker fails a digest that lacks one. */
const SECTION_HEADINGS = ["## Conclusion", "## Main arguments", "## References"];

/** How many main arguments the worker asks for: one per three minutes of transcript, at least two and at most ten. */
function argumentCount(transcript) {
  const stamps = [...transcript.matchAll(/^\[(?:(\d+):)?(\d+):(\d\d)\]/gm)];
  const [, hours = "0", minutes = "0", seconds = "0"] = stamps.at(-1) ?? [];
  const total = Number(hours) * 60 + Number(minutes) + Number(seconds) / 60;
  return Math.min(10, Math.max(2, Math.round(total / 3)));
}

/** Adds the lines the worker writes after `Video:`, which the transcripts in evals/ leave out, as the worker would. */
function withSettings(transcript) {
  const [video, ...rest] = transcript.split("\n");
  return [
    video,
    "Language: English",
    `Headings: ${SECTION_HEADINGS.join(" | ")}`,
    `Main arguments: ${String(argumentCount(transcript))}`,
    ...rest,
  ].join("\n");
}

const MODEL = "claude-haiku-5-5";
const TIMEOUT_MS = 10 * 60 * 1000;

const promptDir = dirname(fileURLToPath(import.meta.url));
const evalsDir = join(promptDir, "evals");

/** What is wrong with the digest's headings: it must start with the first one and have exactly the three, in order. */
function headingProblems(digest) {
  const lines = digest.split("\n").map((line) => line.trim());
  const headings = lines.filter((line) => /^#{1,6}\s/.test(line));
  const problems = SECTION_HEADINGS.filter((heading) => !headings.includes(heading)).map(
    (heading) => `missing ${heading}`,
  );
  if (lines.find(Boolean) !== SECTION_HEADINGS[0]) problems.push(`does not start with ${SECTION_HEADINGS[0]}`);
  if (headings.join("\n") !== SECTION_HEADINGS.join("\n")) problems.push(`headings are ${headings.join(", ")}`);
  return problems;
}

/** The `&t=<seconds>s` links of the digest that point at no timestamp of the transcript. */
function strayMoments(digest, transcript) {
  const moments = new Set(
    [...transcript.matchAll(/^\[(?:(\d+):)?(\d+):(\d\d)\]/gm)].map(([, hours = "0", minutes, seconds]) =>
      String(Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)),
    ),
  );
  return [...digest.matchAll(/&t=(\d+)s/g)].map(([, seconds]) => seconds).filter((seconds) => !moments.has(seconds));
}

/** The Markdown links of the digest, in order. */
function links(digest) {
  return [...digest.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(([, url]) => url);
}

/** The web addresses in the input's description: its `> ` lines between `Description:` and `Transcript:`. */
function descriptionLinks(input) {
  const description = input.match(/^Description:\n((?:>.*\n)*)Transcript:$/m)?.[1] ?? "";
  return [...description.matchAll(/https?:\/\/[^\s）」]+/g)].map(([url]) => url.replace(/[.,;:!?]+$/, ""));
}

/** The links the model added, outside the video's own, that are not in the description. */
function unfoundLinks(digest, input) {
  const described = descriptionLinks(input);
  return links(digest).filter((url) => !url.startsWith("https://www.youtube.com/watch?v=") && !described.includes(url));
}

/** What is wrong with the number of main arguments: exactly as many as the worker asks for. */
function argumentCountProblems(digest, transcript) {
  const expected = argumentCount(transcript);
  const section = digest.split(/^## /m).find((part) => part.startsWith("Main arguments")) ?? "";
  const count = section.split("\n").filter((line) => line.startsWith("- ")).length;
  return count === expected ? [] : [`${String(count)} main arguments, asked for ${String(expected)}`];
}

/** The main arguments that do not start with a linked time range, or whose range starts before the last one ended. */
function argumentRangeProblems(digest) {
  const section = digest.split(/^## /m).find((part) => part.startsWith("Main arguments")) ?? "";
  const seconds = (stamp) => stamp.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  const problems = [];
  let lastEnd = 0;
  for (const line of section.split("\n").filter((line) => line.startsWith("- "))) {
    const range = line.match(
      /^- \[((?:\d+:)?\d+:\d\d)[–-]((?:\d+:)?\d+:\d\d)\]\(https:\/\/www\.youtube\.com\/watch\?v=/,
    );
    if (range === null) {
      problems.push(`argument without a linked time range: ${line.slice(0, 40)}`);
      continue;
    }
    if (seconds(range[1]) < lastEnd) problems.push(`argument overlaps the one before: ${range[1]}–${range[2]}`);
    lastEnd = seconds(range[2]);
  }
  return problems;
}

/** The references that are more than a named link, or a name with the moment it is named. */
function referenceFormatProblems(digest) {
  const section = digest.split(/^## /m).find((part) => part.startsWith("References")) ?? "";
  const linked = /^- \[[^\]]+\]\(https?:\/\/[^)\s]+\)$/;
  const named = /^- [^[\]()]+ \(\[(?:\d+:)?\d+:\d\d\]\(https:\/\/www\.youtube\.com\/watch\?v=[^)\s]+\)\)$/;
  return section
    .split("\n")
    .filter((line) => line.startsWith("- ") && !linked.test(line) && !named.test(line))
    .map((line) => `reference is more than a name and a link: ${line.slice(0, 60)}`);
}

/** Links the developer excluded from references: social accounts, memberships, and affiliate, referral or discount links. */
function excludedLinks(digest) {
  return links(digest).filter(
    (url) =>
      /^https?:\/\/(?:www\.)?(?:x|twitter|instagram|threads|facebook|tiktok|patreon)\.(?:com|net)\//.test(url) ||
      /^https?:\/\/discord\.gg\//.test(url) ||
      /[?&](?:tag|ref|code|aff|affiliate)=/i.test(url),
  );
}

/** Runs `claude -p` on one transcript and resolves with its stream-json events, one per line. */
function runModel(transcript) {
  const workDir = mkdtempSync(join(tmpdir(), "yt-digest-eval-"));
  const args = [
    "-p",
    "--model",
    MODEL,
    "--system-prompt-file",
    join(promptDir, "digest.md"),
    "--tools",
    "",
    "--permission-mode",
    "dontAsk",
    "--safe-mode",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-session-persistence",
    // stream-json carries the same final result as the worker's json, plus any tool the model tried to call.
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
      cwd: workDir,
      // Only what docs/spec.md allows, and none of it as the string "undefined" when unset.
      env: Object.fromEntries(
        ["HOME", "PATH", "USER"].flatMap((name) => (name in process.env ? [[name, process.env[name]]] : [])),
      ),
      stdio: ["pipe", "pipe", "inherit"],
      timeout: TIMEOUT_MS,
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      rmSync(workDir, { recursive: true, force: true });
      if (code === 0) resolve(output);
      // A failed run still prints its result event, which says why, such as a missing login.
      else reject(new Error(`claude exited with ${signal ?? String(code)}: ${output.trim().split("\n").at(-1) ?? ""}`));
    });
    child.stdin.end(transcript);
  });
}

/** The final answer and the tools the model tried to call, in a stream-json run. It has none, so there should be none. */
function readEvents(output) {
  const events = output
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const result = events.find((event) => event.type === "result");
  if (!result || result.is_error) throw new Error(`the run failed: ${JSON.stringify(result)}`);
  const searches = events
    .filter((event) => event.type === "assistant")
    .flatMap((event) => event.message.content)
    .filter((block) => block.type === "tool_use")
    .map((block) => `${block.name}: ${JSON.stringify(block.input)}`);
  return { digest: result.result, searches };
}

/** Prints what the checks find in one run, and whether it failed one. */
function reportRun(name, transcript, output) {
  const { digest, searches } = readEvents(output);
  const report = (problems, ok) => {
    for (const problem of problems) console.log(`${name}: ${problem}`);
    if (!problems.length) console.log(`${name}: ${ok}`);
    return problems.length > 0;
  };
  const failed = [
    report(
      searches.map((search) => `tried a tool it does not have: ${search}`),
      "no tool calls",
    ),
    report(headingProblems(digest), "the three headings, in order, and nothing before them"),
    report(argumentCountProblems(digest, transcript), "as many main arguments as asked for"),
    report(argumentRangeProblems(digest), "every main argument starts with a linked range, none overlapping"),
    report(referenceFormatProblems(digest), "every reference is a named link, or a name and its moment"),
    report(
      strayMoments(digest, transcript).map((seconds) => `moment not in the transcript: &t=${seconds}s`),
      "every moment is a transcript timestamp",
    ),
    report(
      unfoundLinks(digest, transcript).map((url) => `link not in the description: ${url}`),
      "every added link is in the description",
    ),
    report(
      excludedLinks(digest).map((url) => `social, affiliate or referral link: ${url}`),
      "no social, affiliate or referral links",
    ),
  ];
  return { digest, failed: failed.some(Boolean) };
}

const [mode, ...rest] = process.argv.slice(2);
if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // Imported: run nothing.
} else if (mode === "--check" && rest.length === 1) {
  let failed = false;
  for (const file of readdirSync(rest[0]).filter((file) => file.endsWith(".events.jsonl"))) {
    const name = basename(file, ".events.jsonl");
    const transcript = readFileSync(join(evalsDir, `${name}.txt`), "utf8");
    if (reportRun(name, transcript, readFileSync(join(rest[0], file), "utf8")).failed) failed = true;
  }
  process.exitCode = failed ? 1 : 0;
} else if (mode === "--run") {
  const evals = rest.length
    ? rest
    : readdirSync(evalsDir)
        .filter((file) => file.endsWith(".txt"))
        .map((file) => basename(file, ".txt"));
  // A detached HEAD has no branch name, so its runs go under the commit instead.
  const branch =
    execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim() ||
    execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const outDir = join(promptDir, "..", "artifacts", branch, "digests");
  mkdirSync(outDir, { recursive: true });

  let failed = false;
  for (const name of evals) {
    console.log(`${name}: running`);
    try {
      const transcript = readFileSync(join(evalsDir, `${name}.txt`), "utf8");
      const output = await runModel(withSettings(transcript));
      writeFileSync(join(outDir, `${name}.events.jsonl`), output);
      const run = reportRun(name, transcript, output);
      writeFileSync(join(outDir, `${name}.md`), run.digest);
      if (run.failed) failed = true;
    } catch (error) {
      console.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      failed = true;
    }
  }
  console.log(`Digests are in ${outDir}`);
  process.exitCode = failed ? 1 : 0;
} else {
  console.error("Usage: node prompt/run-evals.mjs --run [<eval-name>...]  (each run spends the Claude subscription)");
  console.error("       node prompt/run-evals.mjs --check <folder of saved runs>");
  process.exitCode = 2;
}
