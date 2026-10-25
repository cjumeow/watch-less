# Model answer fixtures

All digest text and errors are invented. JSON fixtures are minimal CLI-shaped examples, not recordings of a live
model run; session identifiers, account details and usage counters are deliberately absent.

- `written.json`: a normalized result with `type: result`, `subtype: success`, `is_error: false`, and four sections.
- `incomplete.json`: the same invented digest without its assessment heading.
- `unknown-error.json`: an invented execution-error result. It must fail, not postpone.
- `usage-limit.txt`: the exact plain-text message previously observed from a Claude CLI call in this development
  session: `You've hit your session limit · resets 3:50pm (Asia/Taipei)`. That call exited zero. It contains no account
  or video data.
- `usage-limit.json`: that observed text placed in an error result envelope for a contract test. The envelope has
  not yet been confirmed against a real subscription-limit response in JSON mode.

The success/result layout follows the CLI's [JSON output documentation](https://code.claude.com/docs/en/headless).
Only the known anchored limit message causes postponement: either an error result or an exact full-stdout plain-text match regardless of exit code.
A successful digest merely quoting that sentence is still a digest. Unknown output and errors fail with a reason.
After the first real JSON-mode limit is observed, compare its sanitized shape and exact message with these fixtures.
Do not broaden the classifier to generic HTTP 429, billing errors or text that merely mentions a limit.
