# toolbelt

Small dev tools in one Bun binary. Ink TUI, or run a command directly.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/victorfern91/toolbelt/main/install.sh | bash
```

Self-contained binary — no Bun or Node needed. Lands in `~/.local/bin`
(`TOOLBELT_INSTALL` / `TOOLBELT_VERSION` to override). macOS and Linux, arm64 and x64.

```bash
toolbelt                        # interactive menu (alias: tb)
toolbelt branch-cleaner
toolbelt switch [name]
toolbelt setup ai               # global AI tools, skills, Claude/Cursor rules
toolbelt install ai             # same as setup ai
toolbelt update                 # latest binary, then refresh the AI stack
toolbelt update ai              # refresh AI stack only
toolbelt upgrade                # same as update
toolbelt review --host          # local diff UI → agent prompt
toolbelt --help
```

## From source

Requires [Bun](https://bun.com) 1.4+.

```bash
bun install
./toolbelt
bun test
bun run build
```
