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

## branch-cleaner

Lists local branches with their state against the default branch, pick what dies.

| state | meaning |
|---|---|
| `current` | checked out, never deletable |
| `merged` | already merged into base |
| `gone` | upstream deleted on the remote |
| `active` | unmerged work |

| key | action |
|---|---|
| `↑↓` / `jk` | move |
| `space` | toggle branch |
| `a` | toggle all safe (merged + gone) |
| `f` | force mode (`git branch -D`) |
| `enter` | delete selected, asks to confirm |
| `q` | quit |

Without force it uses `git branch -d`, so git refuses to drop unmerged work.

```bash
./toolbelt branch-cleaner --list   # plain output, no UI
```

## Adding a tool

1. Create `src/commands/my-tool.tsx` — an Ink component plus a `registerTool({ name, desc, ui, flags })` call at the bottom (copy `branch-cleaner.tsx`).
2. Add one side-effect import for it in `src/commands/index.ts`.

The interactive menu, `--help`, and direct dispatch all read the registry
(`src/commands/registry.ts`), so those two steps are the whole wiring —
the tool lists itself everywhere automatically.

## Releasing

Bump `version` in `package.json`, then push a matching tag. CI cross-compiles
all four targets and attaches them to the release; `install.sh` and
`toolbelt upgrade` both read from the latest release.

```bash
git tag v0.1.0 && git push --tags
```

MIT
