// Vitest runs every test in the repository except those in the worktrees that Claude Code sessions keep under
// .claude/worktrees/: each is a whole checkout of another branch, with its own dependencies.
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
