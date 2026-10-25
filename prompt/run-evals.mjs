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

/** The four section headings, in order. The worker fails a digest that lacks one. */
const SECTION_HEADINGS = ["## 結論", "## 主要論點", "## 影片的來源", "## 評估"];

const MODEL = "opus";
const TIMEOUT_MS = 10 * 60 * 1000;

const promptDir = dirname(fileURLToPath(import.meta.url));
const evalsDir = join(promptDir, "evals");

/** What is wrong with the digest's headings: it must start with the first one and have exactly the four, in order. */
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

/** The links the model added, outside the video's own, that appear in none of the search results it received. */
function unfoundLinks(digest, searchResults) {
  return [...digest.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)]
    .map(([, url]) => url)
    .filter((url) => !url.startsWith("https://www.youtube.com/watch?v=") && !searchResults.includes(url));
}

/** Citations the prompt forbids: a source list after the assessment, and a source without its link. */
function forbiddenCitations(digest) {
  return [/^\**(?:Sources?|參考來源|來源)\**[:：]/m, /（來源：同上）/].filter((pattern) => pattern.test(digest));
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
    "WebSearch",
    "--allowedTools",
    "WebSearch",
    "--permission-mode",
    "dontAsk",
    "--setting-sources",
    "",
    "--strict-mcp-config",
    "--no-session-persistence",
    // stream-json carries the same final result as the worker's json, plus each search the model made.
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

/** The final answer, the tools the model called, and the text of the results those tools returned, in a stream-json run. */
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
  // Only the tools' results, never the model's own messages, which repeat the digest and every link in it.
  const searchResults = events
    .filter((event) => event.type === "user")
    .flatMap((event) => event.message.content)
    .filter((block) => block.type === "tool_result")
    .map((block) => (typeof block.content === "string" ? block.content : JSON.stringify(block.content)))
    .join("\n");
  return { digest: result.result, searches, searchResults };
}

/** Prints what the checks find in one run, and whether it failed one. */
function reportRun(name, transcript, output) {
  const { digest, searches, searchResults } = readEvents(output);
  const report = (problems, ok) => {
    for (const problem of problems) console.log(`${name}: ${problem}`);
    if (!problems.length) console.log(`${name}: ${ok}`);
    return problems.length > 0;
  };
  for (const search of searches) console.log(`${name}: used ${search}`);
  const failed = [
    report(headingProblems(digest), "the four headings, in order, and nothing before them"),
    report(
      strayMoments(digest, transcript).map((seconds) => `moment not in the transcript: &t=${seconds}s`),
      "every moment is a transcript timestamp",
    ),
    report(
      unfoundLinks(digest, searchResults).map((url) => `link in no search result: ${url}`),
      "every added link is in a search result",
    ),
    report(
      forbiddenCitations(digest).map((pattern) => `forbidden citation: ${String(pattern)}`),
      "no forbidden citations",
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
      const output = await runModel(transcript);
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
