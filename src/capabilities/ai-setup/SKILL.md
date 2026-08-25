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
2. It opens a local diff UI and blocks until they submit.
3. Stdout contains a prompt between `<<<TOOLBELT_REVIEW` and `TOOLBELT_REVIEW>>>`.
4. Apply that prompt as the next iteration: keep approved files, address unapproved files and line comments (with the cited locations), apply requested edits. Do not skip locations.

## Other commands

- `tb switch [branch]` — checkout a local branch (prefix ok)
- `tb branch-cleaner` — delete merged/gone local branches
- `tb setup ai` / `tb install ai` — install the AI stack (rtk, skills, global rules)
- `tb upgrade ai` / `tb update ai` — refresh that stack
- `tb upgrade` / `tb update` — replace this binary, then refresh the AI stack
