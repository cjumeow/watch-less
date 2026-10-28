// The release notes of a tag: the section of CHANGELOG.md under the tag's version, which the publish-release workflow
// makes the body of the GitHub release. Fails when the changelog has no entries for that version, so a tag pushed
// before its release pull request is merged publishes nothing.
//
//     node scripts/extract-release-notes.mjs <tag> > notes.md

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The entries under "## [<version>]" for a tag "v<version>", or undefined when there are none. */
export function extractReleaseNotes(changelog, tag) {
  const version = tag.replace(/^v/, "");
  const lines = changelog.split("\n");
  const headingIndex = lines.findIndex((line) => line === `## [${version}]` || line.startsWith(`## [${version}] `));
  if (headingIndex === -1) return undefined;
  // The section ends at the next release heading, or at the link definitions that close a Keep a Changelog file.
  const endIndex = lines.findIndex(
    (line, index) => index > headingIndex && (line.startsWith("## [") || /^\[[^\]]+\]: /.test(line)),
  );
  const notes = lines
    .slice(headingIndex + 1, endIndex === -1 ? undefined : endIndex)
    .join("\n")
    .trim();
  return notes === "" ? undefined : notes;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [tag] = process.argv.slice(2);
  if (!tag) {
    console.error("Usage: node scripts/extract-release-notes.mjs <tag>");
    process.exit(2);
  }
  const notes = extractReleaseNotes(readFileSync("CHANGELOG.md", "utf8"), tag);
  if (notes === undefined) {
    console.error(`CHANGELOG.md has no entries under ## [${tag.replace(/^v/, "")}].`);
    process.exit(1);
  }
  console.log(notes);
}
