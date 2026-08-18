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
toolbelt                        # interactive menu
toolbelt branch-cleaner         # run a tool directly
toolbelt --help
```

## Updates

Every run checks GitHub for a newer release, cached for 24h, capped at a 1.5s
timeout — offline or rate-limited just means no banner.

```bash
toolbelt upgrade                # replaces the running binary in place
```

## From source

```bash
bun install
./toolbelt                      # dev run, no compile
bun test
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

## Releasing

Bump `version` in `package.json`, then push a matching tag. CI cross-compiles
all four targets and attaches them to the release; `install.sh` and
`toolbelt upgrade` both read from the latest release.

```bash
git tag v0.1.0 && git push --tags
```´
