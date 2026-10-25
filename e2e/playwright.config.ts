// The end-to-end tests: the built extension in Playwright's own Chromium, with a temporary profile, on made-up pages
// copying YouTube's markup, with a fake native host. Build first; see .claude/skills/verify/SKILL.md.
//
//     npm run build && npm run test:e2e

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  // Evidence stays on this computer: artifacts/ is ignored by git.
  outputDir: "../artifacts/e2e",
});
