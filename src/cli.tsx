#!/usr/bin/env bun
import { render } from "ink";
import "./commands/index.ts";
import { findTool, tools } from "./commands/registry.ts";
import { Menu } from "./ui/menu.tsx";
import {
  checkForUpdate,
  ensureTbSymlink,
  installTarget,
  isBinary,
  maybePrintUpdateBanner,
  selfUpdate,
  VERSION,
} from "./update.ts";
import { printUpgradeAi } from "./capabilities/ai-setup/index.ts";
import { logger } from "./utils/logger.ts";
import { errMsg } from "./utils/errors.ts";
import { UpdateBanner } from "./ui/update-banner.tsx";

if (isBinary()) {
  try {
    ensureTbSymlink(installTarget());
  } catch {
    // no write access — commands still work
  }
}

const TOOLS = tools();

const [cmd, ...rest] = Bun.argv.slice(2);

const flagHelp = TOOLS.flatMap((t) =>
  Object.entries(t.flags ?? {}).map(
    ([flag, f]) => `  ${(t.name + " " + flag).padEnd(28)} ${f.desc}`,
  ),
);

const HELP = `toolbelt (tb) ${VERSION} — small dev tools, one binary

usage:
  toolbelt | tb                  interactive menu
  toolbelt | tb <tool> [flags]

tools:
${TOOLS.map((t) => {
  const label = t.args ? `${t.name} ${t.args.usage}` : t.name;
  return `  ${label.padEnd(22)} ${t.desc}`;
}).join("\n")}

commands:
  upgrade                        download the latest release over this binary
  upgrade ai                     update rtk, caveman, grill-me, toolbelt skill + refresh global rules
  install ai                     alias for setup ai
  --version                      print version
  --help                         this
${flagHelp.length ? `\nflags:\n${flagHelp.join("\n")}\n` : ""}`;

const fatal = (e: unknown): 1 => {
  logger.error(`✗ ${errMsg(e)}`);
  return 1;
};

if (cmd === "-h" || cmd === "--help") {
  console.log(HELP);
} else if (cmd === "-v" || cmd === "--version") {
  console.log(VERSION);
} else if (cmd === "upgrade" || cmd === "update") {
  if (rest[0] === "ai") {
    const r = await printUpgradeAi();
    process.exit(r.isErr() ? fatal(r.error) : 0);
  }
  if (rest.length) {
    logger.error(`unknown upgrade target: ${rest[0]}\nrun \`toolbelt --help\``);
    process.exit(1);
  }
  process.exit(await selfUpdate());
} else {
  // Kick off in parallel with the command / TUI — never block startup on GitHub.
  const updateCheck = checkForUpdate();

  if (!cmd) {
    render(<Menu updateCheck={updateCheck} />);
  } else {
    const tool = findTool(cmd === "install" ? "setup" : cmd);
    if (!tool) {
      logger.error(`unknown tool: ${cmd}\nrun \`toolbelt --help\``);
      process.exit(1);
    }
    const flag = rest.find((a) => a in (tool.flags ?? {}));
    const action = flag ? tool.flags?.[flag] : undefined;
    if (action) {
      const r = await action.run();
      await maybePrintUpdateBanner(updateCheck);
      process.exit(r.isErr() ? fatal(r.error) : 0);
    } else if (rest.length && tool.args) {
      const r = await tool.args.run(rest);
      await maybePrintUpdateBanner(updateCheck);
      process.exit(r.isErr() ? fatal(r.error) : 0);
    } else if (rest.length) {
      logger.error(`unknown flag: ${rest[0]}\nrun \`toolbelt --help\``);
      process.exit(1);
    } else {
      render(
        <>
          <UpdateBanner check={updateCheck} />
          {tool.ui()}
        </>,
      );
    }
  }
}
