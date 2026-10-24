import { describe, expect, it } from "vitest";

import { checkHasUnreleasedEntry, findAddedLineNumbers } from "./check-changelog-entry.mjs";

const changelog = [
  "# Changelog", // 1
  "", // 2
  "## [Unreleased]", // 3
  "", // 4
  "### Added", // 5
  "", // 6
  "- The 📝 button queues a video.", // 7
  "", // 8
  "## [0.1.0] - 2026-10-23", // 9
  "", // 10
  "- First release.", // 11
].join("\n");

describe("findAddedLineNumbers", () => {
  it("counts lines in the new file across hunks, skipping blank additions", () => {
    const diff = [
      "@@ -4,0 +5,4 @@",
      "+### Added",
      "+",
      "+- The 📝 button queues a video.",
      "+",
      "@@ -9 +11 @@",
      "-old",
      "+new",
    ];
    expect(findAddedLineNumbers(diff.join("\n"))).toEqual([5, 7, 11]);
  });

  it("finds nothing in a diff that only removes lines", () => {
    expect(findAddedLineNumbers(["@@ -7 +6,0 @@", "-- Removed entry."].join("\n"))).toEqual([]);
  });
});

describe("checkHasUnreleasedEntry", () => {
  it("accepts an entry added under Unreleased", () => {
    expect(
      checkHasUnreleasedEntry(changelog, ["@@ -4,0 +5,3 @@", "+### Added", "+", "+- The 📝 button ..."].join("\n")),
    ).toBe(true);
  });

  it("rejects an edit inside an earlier release", () => {
    expect(
      checkHasUnreleasedEntry(changelog, ["@@ -11 +11 @@", "-- First relase.", "+- First release."].join("\n")),
    ).toBe(false);
  });

  it("rejects a pull request that does not touch CHANGELOG.md", () => {
    expect(checkHasUnreleasedEntry(changelog, "")).toBe(false);
  });

  it("accepts an entry when Unreleased is the only section", () => {
    const onlyUnreleased = ["# Changelog", "", "## [Unreleased]", "", "- New entry."].join("\n");
    expect(checkHasUnreleasedEntry(onlyUnreleased, ["@@ -4,0 +5 @@", "+- New entry."].join("\n"))).toBe(true);
  });
});
