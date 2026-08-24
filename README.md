# toolbelt

Small dev tools in one Bun binary. React (Ink) TUI, or plain commands.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/victorfern91/toolbelt/main/install.sh | bash
```

Single self-contained binary, no Bun or Node needed on the machine. Lands in
`~/.local/bin` — override with `TOOLBELT_INSTALL=/usr/local/bin`, pin a version
with `TOOLBELT_VERSION=v0.1.0`. macOS and Linux, arm64 and x64.

```bash
toolbelt                        # interactive menu (alias: tb)
toolbelt branch-cleaner         # run a tool directly
toolbelt switch                 # pick a local branch
toolbelt switch main            # or pass a name / unique prefix
toolbelt setup ai               # global AI tools + Claude/Cursor rules
toolbelt upgrade ai             # update those tools + refresh rules
toolbelt --help
```

## Updates

Startup kicks off a GitHub release check in parallel with the TUI / command
(1.5s timeout). If a newer version exists, an update banner appears — offline
or rate-limited just means no banner.

```bash
toolbelt upgrade                # replaces the running binary in place
toolbelt upgrade ai             # latest rtk, caveman, grill-me + refresh rules
```

## From source

Requires [Bun](https://bun.com) 1.4 or newer.

```bash
bun install
./toolbelt                      # dev run, no compile
bun test
bun run lint                    # oxlint
bun run format                  # oxfmt (format:check to verify only)
bun run build                   # dist/toolbelt for this platform
bun run build:all               # every release target
```

## Adding a tool

Commands self-register. Each command is a folder under `src/commands/`:

```
src/commands/my-tool/
├── command.tsx   # Ink component + registerTool() call at the bottom
└── store.ts      # optional: state for the UI
```

`command.tsx` calls `registerTool({ name, desc, ui, flags })` (see
`src/commands/branch-cleaner/command.tsx`):

- `name` / `desc` — how the tool shows up in the menu and `--help`
- `ui` — the Ink component to render
- `flags` — optional non-interactive entry points, e.g. `--list`

`store.ts` keeps UI state out of the component: an immer-backed reducer
behind a context provider, exposed as a `useMyToolState()` hook (see
`src/commands/branch-cleaner/store.ts`). Shared capabilities (git, …)
live under `src/capabilities/`, not in the command.

Then add one side-effect import in `src/commands/index.ts`:

```ts
import "./my-tool/command.tsx";
```

The interactive menu, `--help`, and direct dispatch all read the registry
(`src/commands/registry.ts`), so those two steps are the whole wiring —
the tool lists itself everywhere automatically.

Positional args (e.g. `tb switch feat/foo`) go through `args: { usage, desc, run }`
on the tool. Subcommands (e.g. `tb setup ai`) are flags without `--`.

## Tools

### switch

Lists local branches (newest first). Enter checks one out. Pass a name to skip the UI:

```bash
tb switch
tb switch main
tb switch feat/   # unique prefix or substring is enough
```

### setup ai

Idempotent machine-wide AI setup:

- writes a managed rules block to `~/.claude/CLAUDE.md`
- writes `~/.cursor/rules/toolbelt.mdc` (`alwaysApply`)
- installs **rtk** (Rust Token Killer) and runs `rtk init -g --auto-patch`
- installs **caveman** and **grill-me** globally for Claude Code + Cursor

Rules live in `src/capabilities/ai-setup/rules.yaml` — add there, then
`tb upgrade ai` (or `tb setup ai`) to write them out.

`tb upgrade ai` re-installs rtk, re-adds caveman/grill-me, and refreshes the
global rule files. `tb upgrade` with no args still only updates this binary.

## Releasing

Bump `version` in `package.json`, then push a matching tag. CI cross-compiles
all four targets and attaches them to the release; `install.sh` and
`toolbelt upgrade` both read from the latest release.

```bash
git tag v0.1.0 && git push --tags
```
