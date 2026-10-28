import { describe, expect, it } from "vitest";

import { extractReleaseNotes } from "./extract-release-notes.mjs";

const changelog = [
  "# Changelog",
  "",
  "## [Unreleased]",
  "",
  "### Fixed",
  "",
  "- Not released yet.",
  "",
  "## [0.2.0] - 2026-11-30",
  "",
  "### Added",
  "",
  "- A second release.",
  "",
  "## [0.1.0] - 2026-10-28",
  "",
  "### Added",
  "",
  "- The first release.",
  "",
  "[unreleased]: https://github.com/example/yt-digest/compare/v0.2.0...HEAD",
  "[0.2.0]: https://github.com/example/yt-digest/compare/v0.1.0...v0.2.0",
  "[0.1.0]: https://github.com/example/yt-digest/releases/tag/v0.1.0",
  "",
].join("\n");

describe("extractReleaseNotes", () => {
  it("returns the section of the tag's version, up to the next release", () => {
    expect(extractReleaseNotes(changelog, "v0.2.0")).toBe("### Added\n\n- A second release.");
  });

  it("stops the last release before the link definitions", () => {
    expect(extractReleaseNotes(changelog, "v0.1.0")).toBe("### Added\n\n- The first release.");
  });

  it("finds nothing for a version the changelog does not have", () => {
    expect(extractReleaseNotes(changelog, "v0.3.0")).toBeUndefined();
  });

  it("finds nothing for a release heading with no entries", () => {
    const empty = ["# Changelog", "", "## [0.1.0] - 2026-10-28", "", "## [0.0.1] - 2026-10-01", "", "- x"].join("\n");
    expect(extractReleaseNotes(empty, "v0.1.0")).toBeUndefined();
  });

  it("does not take a version that only starts like the tag's", () => {
    const similar = ["## [0.1.0-beta] - 2026-10-01", "", "- Beta."].join("\n");
    expect(extractReleaseNotes(similar, "v0.1.0")).toBeUndefined();
  });
});
