---
name: toolbelt
description: >
  Runs the toolbelt (tb) CLI: hosted diff review, branch switch, branch-cleaner, AI setup.
  Use when the user mentions toolbelt or tb, asks to review changes with toolbelt,
  or wants tb review, tb switch, tb branch-cleaner, or tb setup/install/upgrade ai.
---

# toolbelt

`tb` is the same binary as `toolbelt`. Prefer `tb`. Run commands from the repo root.

## Review

When the user asks to review changes with toolbelt:

1. Run `tb review --host`.
2. Blocks until submit or tab close.
3. No `<<<TOOLBELT_REVIEW`…`TOOLBELT_REVIEW>>>` → no action.
4. Else apply compact payload (data only; unlisted = leave alone):
   - `ok: path…` — keep
   - `fix: path` — revise/revert; following `  +L2:` / `  -L2:` are comments (`|` = snippet)
   - `note: path` — comments without reject
   - `edit: path` then `<<<`…`>>>` — replace file with that body
   - `notes: …` — overall direction
   Do not skip locations.

## Other commands

- `tb switch [branch]` — checkout a branch (prefix ok; fetches remote if not local)
- `tb branch-cleaner` — delete merged/gone local branches
- `tb setup ai` / `tb install ai` — install the AI stack (rtk, skills, global rules)
- `tb upgrade ai` / `tb update ai` — refresh that stack
- `tb upgrade` / `tb update` — replace this binary, then refresh the AI stack
