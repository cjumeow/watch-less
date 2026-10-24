# TypeScript toolchain

Date: 2026-10-24. Status: accepted.

## Context

The repository will hold three programs that share types: a Chrome extension, a Native Messaging host and a worker,
the last two in Node.js. Agents write most of the code, so the toolchain has to catch their mistakes mechanically, run
the same way on a laptop and in CI, and stay small enough to learn. The developer's bookmark-organizer repository
settled the same question a day earlier, and this one follows it so the two work the same way.

## Decision

- **npm workspaces**, one per program plus `shared/`, in one repository with one lockfile. npm ships with Node; pnpm
  was the alternative, faster but one more tool. Each program's workspace is added in the pull request that builds it.
- **TypeScript 6.0** in strict mode, with `noUncheckedIndexedAccess`. TypeScript 7.0 is out, but typescript-eslint
  8.72 supports TypeScript below 6.1 only, and the type-aware lint rules matter more than the newer compiler.
- **ESLint with typescript-eslint's `strictTypeChecked` and `stylisticTypeChecked`**, which use the type checker to
  catch what agents often get wrong, such as an unawaited promise. **Prettier** formats code at 120 columns;
  `eslint-config-prettier` turns off the lint rules that would fight it. Markdown is left to hand-wrapping. Biome, one
  tool for both, was the alternative; ESLint and Prettier are what most repositories use.
- **Vitest** runs the tests with no configuration file.
- **esbuild** will bundle each program with `shared/`, which has no build of its own; `tsc` only type-checks. WXT, a
  framework for extensions, was the alternative for the extension: it brings a dev server and its own conventions that
  a content script and a service worker do not need.
- **Node.js 24** (`.nvmrc`), the current long-term-support line, locally and in CI.
- Dependencies are pinned to exact versions, so an install never picks up a release nobody reviewed.

## Consequences

- `npm run check` runs every check CI runs, in the same order.
- Moving to TypeScript 7 waits for typescript-eslint to support it.
- Pinned versions need deliberate updates; Dependabot can propose them.
