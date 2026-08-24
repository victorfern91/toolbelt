import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_RULES,
  applyAgentRules,
  CLAUDE_END,
  CLAUDE_START,
  claudePath,
  cursorRulePath,
  upsertBlock,
  type AgentRule,
} from "./rules.ts";

test("rules.yaml is loaded by Bun", async () => {
  const parsed = Bun.YAML.parse(
    await Bun.file(join(import.meta.dir, "rules.yaml")).text(),
  ) as AgentRule[];
  expect(parsed[0]?.id).toBe("concise-reporting");
  expect(AGENT_RULES).toEqual(parsed);
});

test("upsert preserves existing content", () => {
  const next = upsertBlock("@RTK.md\n", "## Reporting\nhi");
  expect(next.startsWith("@RTK.md")).toBe(true);
  expect(next).toContain(CLAUDE_START);
  expect(next).toContain("## Reporting\nhi");
  expect(next).toContain(CLAUDE_END);
});

test("upsert replaces a previous managed block", () => {
  const first = upsertBlock("@RTK.md\n", "old");
  const second = upsertBlock(first, "new");
  expect(second).toContain("new");
  expect(second).not.toContain("old");
  expect(second.split(CLAUDE_START).length).toBe(2);
});

test("applyAgentRules writes Claude + Cursor files", async () => {
  const home = mkdtempSync(join(tmpdir(), "tb-ai-"));
  try {
    const r = await applyAgentRules(home);
    expect(r.isOk()).toBe(true);
    if (r.isErr()) return;
    const claude = await Bun.file(claudePath(home)).text();
    const cursor = await Bun.file(cursorRulePath(home)).text();
    expect(claude).toContain(AGENT_RULES[0]!.body);
    expect(claude).toContain("rtk git status");
    expect(cursor).toContain("alwaysApply: true");
    expect(cursor).toContain(AGENT_RULES[0]!.body);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
