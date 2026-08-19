#!/usr/bin/env bun
import { useState } from "react";
import { Box, render, Text, useApp, useInput } from "ink";
import { isErrored } from "@attio/fetchable";
import "./commands/index.ts";
import { findTool, tools } from "./commands/registry.ts";
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
    <Box flexDirection="column">
      <Text backgroundColor="magenta" color="black" bold>
        {" toolbelt "}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {TOOLS.map((t, i) => (
          <Text key={t.name}>
            <Text color={i === cursor ? "magenta" : undefined}>{i === cursor ? "❯ " : "  "}</Text>
            <Text bold={i === cursor} color="cyan">
              {t.name.padEnd(18)}
            </Text>
            <Text dimColor>{t.desc}</Text>
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          <Text color="magenta">↑↓</Text> move · <Text color="magenta">enter</Text> run ·{" "}
          <Text color="magenta">q</Text> quit
        </Text>
      </Box>
    </Box>
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
${TOOLS.map((t) => `  ${t.name.padEnd(18)} ${t.desc}`).join("\n")}

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
    const cmd  = `     run \x1b[36;1mtoolbelt upgrade\x1b[0m\x1b[33m to update                  `;
    const bar  = "─".repeat(line.length - 2);
    console.log(
      `\x1b[33m┌${bar}┐\x1b[0m\n` +
      `\x1b[33m│\x1b[0m\x1b[1m${line}\x1b[0m\x1b[33m│\x1b[0m\n` +
      `\x1b[33m│\x1b[0m${cmd}\x1b[33m│\x1b[0m\n` +
      `\x1b[33m└${bar}┘\x1b[0m\n`,
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
      process.exit(isErrored(r) ? fatal(r.error) : 0);
    } else {
      render(tool.ui());
    }
  }
}
