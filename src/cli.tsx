#!/usr/bin/env bun
import { useState } from "react";
import { render, useApp, useInput } from "ink";
import "./commands/index.ts";
import { findTool, tools } from "./commands/registry.ts";
import { Hints, MenuRow, Screen } from "./ui/screen.tsx";
import { ansi } from "./ui/theme.ts";
import { checkForUpdate, selfUpdate, VERSION } from "./update.ts";
import { logger } from "./utils/logger.ts";
import { errMsg } from "./utils/errors.ts";

const TOOLS = tools();

function Menu() {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  useInput((input, key) => {
    if (chosen !== null) return;
    if (input === "q" || key.escape) return exit();
    if (key.downArrow || input === "j") setCursor((c) => (c + 1) % TOOLS.length);
    if (key.upArrow || input === "k") setCursor((c) => (c - 1 + TOOLS.length) % TOOLS.length);
    if (key.return) setChosen(cursor);
  });

  if (chosen !== null) return TOOLS[chosen]!.ui();

  return (
    <Screen
      badge="toolbelt"
      footer={
        <Hints
          keys={[
            ["↑↓", "move"],
            ["enter", "run"],
            ["q", "quit"],
          ]}
        />
      }
    >
      {TOOLS.map((t, i) => (
        <MenuRow key={t.name} on={i === cursor} label={t.name} desc={t.desc} width={20} />
      ))}
    </Screen>
  );
}

const [cmd, ...rest] = Bun.argv.slice(2);

const flagHelp = TOOLS.flatMap((t) =>
  Object.entries(t.flags ?? {}).map(
    ([flag, f]) => `  ${(t.name + " " + flag).padEnd(28)} ${f.desc}`,
  ),
);

const HELP = `toolbelt ${VERSION} — small dev tools, one binary

usage:
  toolbelt                       interactive menu
  toolbelt <tool> [flags]

tools:
${TOOLS.map((t) => {
  const label = t.args ? `${t.name} ${t.args.usage}` : t.name;
  return `  ${label.padEnd(22)} ${t.desc}`;
}).join("\n")}

commands:
  upgrade                        download the latest release over this binary
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
  process.exit(await selfUpdate());
} else {
  const latest = await checkForUpdate();
  if (latest) {
    const line = `  🚀 toolbelt ${latest} is available  (you have ${VERSION})  `;
    const cmd = `     run ${ansi.bold}${ansi.accent}toolbelt upgrade${ansi.reset}${ansi.warn} to update                  `;
    const bar = "─".repeat(line.length - 2);
    console.log(
      `${ansi.warn}┌${bar}┐${ansi.reset}\n` +
        `${ansi.warn}│${ansi.reset}${ansi.bold}${line}${ansi.reset}${ansi.warn}│${ansi.reset}\n` +
        `${ansi.warn}│${ansi.reset}${cmd}${ansi.warn}│${ansi.reset}\n` +
        `${ansi.warn}└${bar}┘${ansi.reset}\n`,
    );
  }

  if (!cmd) {
    render(<Menu />);
  } else {
    const tool = findTool(cmd);
    if (!tool) {
      logger.error(`unknown tool: ${cmd}\nrun \`toolbelt --help\``);
      process.exit(1);
    }
    const flag = rest.find((a) => a in (tool.flags ?? {}));
    const action = flag ? tool.flags?.[flag] : undefined;
    if (action) {
      const r = await action.run();
      process.exit(r.isErr() ? fatal(r.error) : 0);
    } else if (rest.length && tool.args) {
      const r = await tool.args.run(rest);
      process.exit(r.isErr() ? fatal(r.error) : 0);
    } else if (rest.length) {
      logger.error(`unknown flag: ${rest[0]}\nrun \`toolbelt --help\``);
      process.exit(1);
    } else {
      render(tool.ui());
    }
  }
}
