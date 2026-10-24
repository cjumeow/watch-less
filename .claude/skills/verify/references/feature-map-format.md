# Feature map format

The feature map is the list of what a user can do with yt-digest, written so an agent that has never seen
the app can reach each feature, drive it, and prove it works. It lives in `.claude/skills/verify/features/`: an index
in `README.md` and one file per user-facing feature.

The user of this product is the developer browsing YouTube, so a feature is something they can do or get: queue a
video from its thumbnail, queue it from the context menu, find its digest in Heptabase. Internal parts (caption
parsing, the queue, the native host) are not features; they are proven through the features that use them.

## The index

`features/README.md` has one row per feature:

```markdown
| Feature | File | Surfaces | Status |
|---|---|---|---|
| Digest a video from its thumbnail | [digest-from-thumbnail.md](digest-from-thumbnail.md) | 📝 button, worker, Heptabase | proven in #12 |
```

`Status` is `planned`, `built`, or `proven in #<pull request>`: the last pull request whose Verification section
proved every journey in the file. Name the pull request, not a commit: pull requests are squash-merged and their
branches deleted, so a branch commit's SHA does not survive the merge.

## A feature file

The file is named for what the user does, in kebab-case (`digest-from-thumbnail.md`). It opens with a title and one paragraph,
from the user's point of view, on what the feature is for. Then four sections, always these, in this order:

- `## Sub-features`: each separate thing the feature does, one line each, with a short id.
- `## How to get to it (user POV)`: every entry point a user has, such as the 📝 button on a thumbnail or the
  context menu on a link. A proof covers all of them.
- `## Driving it`: the preconditions, then one bold step per action, each with the exact command to run and the
  observable result that shows it worked. The last step is **Proof**: what to capture, where, and what it must show.
- `## Gotchas`: what makes a run fail or mislead: ordering, timing, seed data it needs, and proof that looks
  sufficient but is not.

Commands are the real ones from this repository, never placeholders. Observations name a concrete value ("the card's
claims table has 4 rows"), not "it works".
