import { describe, expect, it } from "vitest";

import { subjectOf, titleProblems } from "./check-title.mjs";

describe("titleProblems", () => {
  it("accepts a Conventional Commits title within 72 characters", () => {
    expect(titleProblems("feat: request a digest with a Summarize item in YouTube's video menu")).toEqual([]);
  });

  it("refuses a title longer than 72 characters, saying how long it is", () => {
    const title = `fix: ${"a".repeat(70)}`;
    expect(titleProblems(title)).toEqual([
      "The title is 75 characters; keep it within 72, where GitHub starts cutting titles.",
    ]);
  });

  it.each([
    ["no type", "add a button"],
    ["an unknown type", "feature: add a button"],
    ["a scope", "feat(extension): add a button"],
    ["a capital letter", "feat: Add a button"],
    ["a trailing period", "feat: add a button."],
  ])("refuses %s", (_case, title) => {
    expect(titleProblems(title)).toHaveLength(1);
  });

  it.each(["Merge branch 'main' into feat/popup", "fixup! feat: add a button", "squash! feat: add a button"])(
    "lets git's own subjects through: %s",
    (title) => {
      expect(titleProblems(title)).toEqual([]);
    },
  );
});

describe("subjectOf", () => {
  it("reads the first line of a commit message, skipping git's comment lines", () => {
    expect(subjectOf("# Please enter the commit message\n\nfeat: add a button\n\nThe body.\n")).toBe(
      "feat: add a button",
    );
  });
});
