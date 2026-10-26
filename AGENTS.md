# yt-digest

A button on each YouTube thumbnail that turns the video into a faithful summary, a **digest**: a
Markdown document, delivered to a **destination** (Heptabase first), without opening the video. A Chrome extension
sends the request through a Native Messaging host; a worker on this Mac fetches the transcript, asks `claude -p` for
the digest, and delivers it.

Status: the repository's skeleton (toolchain, checks, CI, skills) exists; no program does yet. What the first version
does is in the spec, `docs/spec.md`, and the features are built from it.

## A learning project

The developer builds this to learn how to run a project with coding agents: CI/CD, lint rules and conventions,
skills, agent files, testing. So besides doing the task:

- When you introduce a tool, a configuration, a convention or a workflow (a lint rule, a GitHub workflow, a hook, a
  skill, a Claude Code feature), explain it to the developer: what it is, what problem it solves, and the alternative
  you did not pick and why. Keep it short.
- Prefer what Claude Code already has (built-in commands, hooks, subagents, worktrees, skills) over writing something
  new, and say which one you used.
- Record a decision as a short ADR in `docs/adr/NNNN-<title>.md` when it is hard to reverse, surprising without
  context, and the result of a real trade-off. The format and the test are in
  [`ADR-FORMAT.md`](.claude/skills/domain-modeling/ADR-FORMAT.md).
- When a practice is worth reusing in other projects, propose turning it into a skill. Do not create one unasked.

Talk with the developer in Traditional Chinese (繁體中文). Everything in the repository (code, docs, commit messages,
pull requests) is in English; a digest is in the language the developer picks, English by default.

## Principles that shape the design

- **The model judges, the programs execute.** What a video claims and how strong its evidence is, is decided by
  `claude -p` following the prompt in `prompt/`. The extension, the native host and the worker never judge content:
  they queue a video, fetch its transcript, run the model and store the result.
- **The transcript is untrusted.** It is someone else's text and may try to give the model instructions. The model
  runs with only the tools the digest needs, in an empty working folder, and nothing it writes is executed.
- **Local, with the developer's own subscription.** Everything runs on this Mac. `claude -p` uses the developer's
  Claude subscription and never an API key, and yt-digest is never offered to anyone else as a service.
- **What the developer watches stays on the computer.** Video IDs, titles, transcripts and digests never enter the
  repository, its tests or its pull requests.
- **One name per concept** in code, docs and the prompt. Terms are defined in `GLOSSARY.md` as they are decided.
- **A rule a program can check is checked by a program** (a lint rule, a script, a CI step), not only written down.
  Rules that need judgment stay in skills and in review.

## Where things go

Update this table when the layout changes. Rows marked (planned) do not exist yet.

| Looking for | Place |
|---|---|
| Code the programs share, exported from `src/index.ts`: the request, the reply and the queue file with their parsers (`parseRequest`, `parseReply`, `parseQueueFile`), and the button's messages (`BUTTON_MESSAGES`) | `shared/` |
| The Chrome extension: the Summarize item and its content script, the toolbar popup that picks the digest's language and model (kept in `chrome.storage.local`), and the service worker that sends the request with them to the native host | `extension/` |
| End-to-end tests: the built extension in Playwright's Chromium on made-up pages copying YouTube's markup, with a fake native host | `e2e/` |
| The Native Messaging host and its Chrome manifest template | `native-host/` |
| The worker that turns a queued video into a digest: the loop in `src/run-queue.ts`, each step's interface in `src/transcript/`, `src/model/` and `src/destination/`, and its launchd agent | `worker/` |
| The digest prompt, the contract with the worker, and the evaluations | `prompt/` |
| Shared TypeScript settings, lint and format rules | `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json` |
| Repository checks that are not lint rules, the scripts hooks run, `setup.sh`, which checks and installs the tools yt-digest runs on, and `install-local.sh`, which installs yt-digest for this account, with their tests | `scripts/` |
| Git hooks, which `npm install` turns on: `commit-msg` refuses a subject the pull request title check would | `.githooks/` |
| Claude Code hooks for every agent in this repository: Prettier formats each file an agent writes or edits | `.claude/settings.json` |
| Skills for developing this repository | `.claude/skills/<name>/SKILL.md` (other agents read them through the `.agents/skills` link) |
| Where each third-party skill came from, at which commit | `.claude/skills/THIRD_PARTY.md` |
| What changed for the user | `CHANGELOG.md` |
| How to prove a change, and the map of user-facing features | `.claude/skills/verify/`, `.claude/skills/verify/features/` |
| Verification evidence files, kept on this computer and ignored by git | `artifacts/<branch>/` |
| Design decisions | `docs/adr/` |
| Clickable prototypes the developer tries before a UI is built, one HTML file each that opens in a browser | `docs/prototypes/` |
| The domain's terms, one name each | `GLOSSARY.md` |
| The spec: what the first version does, from the button to the notification | `docs/spec.md` |
| GitHub workflows | `.github/workflows/<verb>-<object>.yml` |

### Shared code

`shared/` is the workspace `@yt-digest/shared`. It is TypeScript source with no build of its own: `tsc` and Vitest
read `shared/src/` directly, and the programs will bundle it.

- Import it by its package name, `@yt-digest/shared`, never by a relative path. `shared/src/index.ts` exports
  everything that is public.
- It runs in both an extension service worker and Node.js, so it uses neither `chrome` nor Node's modules. Its
  `tsconfig.json` loads the types of a web worker and not those of `chrome` or Node, so `npm run typecheck` fails when
  it uses either.

## Skills and commands to use

| Before you | Use |
|---|---|
| commit, push a branch, or open or merge a pull request | [`commit-and-pull-request-convention`](.claude/skills/commit-and-pull-request-convention/SKILL.md) |
| say a change works, or write a pull request's Verification section | [`verify`](.claude/skills/verify/SKILL.md) |
| plan a feature or settle an open design decision | [`/grill-with-docs`](.claude/skills/grill-with-docs/SKILL.md), which only the developer can start; it runs `grilling` and `domain-modeling` |
| stress-test a plan without writing docs | [`grilling`](.claude/skills/grilling/SKILL.md) |
| name a domain concept, or write `GLOSSARY.md` or an ADR | [`domain-modeling`](.claude/skills/domain-modeling/SKILL.md) |
| write or change pure logic, such as caption parsing or job validation | [`tdd`](.claude/skills/tdd/SKILL.md), test-first, one test and its implementation at a time |
| design a module's interface or decide where a seam goes | [`codebase-design`](.claude/skills/codebase-design/SKILL.md), which `tdd` also calls for its terms |
| open a pull request | `/code-review` on the change |
| change the native host, how `claude -p` is run, or the extension's permissions | `/security-review` |
| finish a change that grew larger than planned | `/simplify` |
| debug a failing test, a broken feature or a regression | [`diagnosing-bugs`](.claude/skills/diagnosing-bugs/SKILL.md) |
| create or change a skill | `skill-creator` |
| write or edit a skill or `AGENTS.md` | [`writing-for-agents`](.claude/skills/writing-for-agents/SKILL.md), alongside `skill-creator` |
| look back on a finished issue or session and improve the agent's environment | [`/retro`](.claude/skills/retro/SKILL.md), which only the developer can start; it runs `writing-for-agents` |

Add a row when a skill is added under `.claude/skills/`. List only skills that exist.

`tdd` writes tests only at seams confirmed with the developer. An agent working on an issue without the developer
present takes the seams listed in the issue as confirmed; an issue for pure logic lists its seams, and an agent that
needs a seam the issue does not list asks before testing there.

## Workflow

- Every change ends as a pull request: work on a branch from `main`, one issue per branch, then push it and open the
  pull request yourself when the change is ready. Who merges it is in [Sessions and merging](#sessions-and-merging).
  Pull requests are squash-merged, so the title becomes the commit on `main`. How to write branches, commits, the changelog and pull requests is in
  [`commit-and-pull-request-convention`](.claude/skills/commit-and-pull-request-convention/SKILL.md).
- Issues are written so several sessions can implement them at once, each in its own worktree: an issue owns a
  folder or set of files that no other open issue touches, names the issues it waits for, and lists the seams `tdd`
  may test. Types two programs share are their own issue in `shared/`, done first, so the issues that use them can
  run side by side.
- A change to what the developer sees (the button, a notification, a digest's layout) starts from a prototype the
  developer tries and confirms; it is built only after that.
- Pick the skills in the table above yourself, for design as for code; the developer does not need to name them.
- Keep pull requests small enough to read in one sitting. Never merge code you cannot explain.
- A change to what a document in `docs/` describes updates that document in the same pull request.
- Ask the developer before anything that needs their credentials or changes their system settings (installing a
  launchd agent or a Native Messaging host manifest, granting permissions).

### Sessions and merging

- **One session talks to the developer.** It writes the issues and starts one session per issue, one after another
  or side by side when they touch no common files. An issue's session that meets a decision the spec and the docs do
  not settle asks that top session, which answers from the docs or asks the developer; the developer is asked in that
  one place.
- **An agent merges its own pull request** (squash) when all of these hold: every CI check passes, `/code-review`
  leaves no unresolved finding, and the Verification section shows its main claim at level 4 or 5. After a merge, the
  top session tells the developer in a few sentences what landed and any tool or technique that was new.
- **The developer merges** a pull request that changes the native host, how `claude -p` is run, or the extension's
  permissions (after `/security-review`), and one that changes the workflows in `.github/workflows/` or the rules in
  this file and the skills.

There are no releases and no release workflow yet: yt-digest is a personal tool, installed from a checkout.

## Proving a change

A change is done when it is proven on the real thing, not when it compiles or its tests pass: run a build of a
commit, never the working tree, observe the result, and put the evidence in the pull request's Verification section.
What counts as proof for each kind of change, how to drive each program in isolation, the end-to-end tests and the
feature map are in [`verify`](.claude/skills/verify/SKILL.md).

## Commands

Node.js 24 (`.nvmrc`). Why the toolchain is what it is: [ADR 1](docs/adr/0001-typescript-toolchain.md).

```bash
npm install
npm run check            # everything CI runs, in order: the commands below
npm run format:check     # Prettier; `npm run format` fixes it
npm run lint             # ESLint with type-aware rules
npm run typecheck        # tsc in every workspace
npm test                 # Vitest
npm run build            # every workspace that has a build
npm run setup            # the developer's step: check the tools yt-digest runs on, and offer to install missing ones
npm run setup -- --check # the same check, installing nothing: safe for agents
npm run install-local    # the developer's step: install the last commit outside the checkout, or update it
npm run install-local -- --dry-run   # the same into a new temporary home, with no launchctl: safe for agents
```

`install-local` builds the commit, not the working tree, and copies what runs into
`~/Library/Application Support/yt-digest/app/`, because Chrome cannot start a host from `~/Desktop`, which macOS
protects, and because a branch switched or rebuilt in the checkout must not change the yt-digest in use.

Dependencies are pinned to exact versions.
