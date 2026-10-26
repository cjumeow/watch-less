// The rule for a commit subject and a pull request title, which become the same line on main: Conventional Commits
// with no scope, lowercase after the colon, no trailing period, and at most 72 characters. The commit-msg hook in
// .githooks runs it on each commit, and check-pull-request-conventions on each pull request's title.
//
//     node scripts/check-title.mjs <title>
//     node scripts/check-title.mjs --commit-msg <file git passes the hook>

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FORMAT = /^(feat|fix|refactor|docs|test|ci|chore): [a-z0-9`].*[^.]$/;
const MAX_LENGTH = 72;

// Subjects git writes itself, for a merge or for a commit to fold in later, which never reach main on their own.
const GIT_SUBJECTS = /^(Merge |fixup! |squash! |amend! )/;

/** What is wrong with `title`, as messages to print; empty when nothing is. */
export function titleProblems(title) {
  if (GIT_SUBJECTS.test(title)) return [];
  const problems = [];
  if (!FORMAT.test(title)) {
    problems.push(
      "The title must be '<type>: <sentence>': type feat, fix, refactor, docs, test, ci or chore; " +
        "the sentence starts lowercase and has no trailing period.",
    );
  }
  if (title.length > MAX_LENGTH) {
    problems.push(
      `The title is ${String(title.length)} characters; keep it within ${String(MAX_LENGTH)}, where GitHub starts cutting titles.`,
    );
  }
  return problems;
}

/** The subject of a commit message as git hands it to the hook: its first line that is not a comment. */
export function subjectOf(message) {
  return (
    message
      .split("\n")
      .find((line) => line.trim() !== "" && !line.startsWith("#"))
      ?.trim() ?? ""
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [first, second] = process.argv.slice(2);
  const title = first === "--commit-msg" && second ? subjectOf(readFileSync(second, "utf8")) : first;
  if (title === undefined) {
    console.error("Usage: node scripts/check-title.mjs <title> | --commit-msg <file>");
    process.exit(2);
  }
  const problems = titleProblems(title);
  // GitHub Actions shows a line starting with ::error:: as an annotation on the run.
  const prefix = process.env.GITHUB_ACTIONS === "true" ? "::error::" : "";
  for (const problem of problems) console.error(`${prefix}${problem}`);
  process.exitCode = problems.length > 0 ? 1 : 0;
}
