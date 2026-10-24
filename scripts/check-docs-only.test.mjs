import { describe, expect, it } from "vitest";

import { isDocsOnly } from "./check-docs-only.mjs";

describe("isDocsOnly", () => {
  it("accepts a change to Markdown documentation only", () => {
    expect(
      isDocsOnly(["README.md", "docs/spec.md", "docs/adr/0005-example.md", ".claude/skills/verify/SKILL.md"]),
    ).toBe(true);
  });

  it("refuses a change that also touches code", () => {
    expect(isDocsOnly(["README.md", "worker/src/index.ts"])).toBe(false);
  });

  it("refuses a change to a workflow, which is not Markdown", () => {
    expect(isDocsOnly([".github/workflows/check-code.yml"])).toBe(false);
  });

  it("refuses a change to the digest prompt, which is part of the product", () => {
    expect(isDocsOnly(["prompt/digest.md"])).toBe(false);
  });

  it("refuses an empty change, so nothing is skipped by accident", () => {
    expect(isDocsOnly([])).toBe(false);
  });
});
