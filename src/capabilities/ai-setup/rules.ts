import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import yaml from "./rules.yaml" with { type: "yaml" };

export type AgentRule = {
  id: string;
  title: string;
  body: string;
};

/** Loaded from `rules.yaml` — `tb setup ai` / `tb install ai` / `tb upgrade ai` upsert into Claude + Cursor. */
export const AGENT_RULES: AgentRule[] = yaml;

export const CLAUDE_START = "<!-- toolbelt-ai -->";
export const CLAUDE_END = "<!-- /toolbelt-ai -->";

export const upsertBlock = (existing: string, inner: string): string => {
  const block = `${CLAUDE_START}\n${inner.trim()}\n${CLAUDE_END}`;
  const i = existing.indexOf(CLAUDE_START);
  const j = existing.indexOf(CLAUDE_END);
  if (i !== -1 && j !== -1 && j > i) {
    return existing.slice(0, i) + block + existing.slice(j + CLAUDE_END.length);
  }
  const trimmed = existing.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
};

export const renderRules = (rules: AgentRule[] = AGENT_RULES) =>
  rules.map((r) => `## ${r.title}\n${r.body}`).join("\n\n");

export const renderCursorRule = (rules: AgentRule[] = AGENT_RULES) =>
  `---
description: toolbelt global agent rules
alwaysApply: true
---

${renderRules(rules)}
`;

export const claudePath = (home: string) => join(home, ".claude", "CLAUDE.md");
export const cursorRulePath = (home: string) => join(home, ".cursor", "rules", "toolbelt.mdc");

export const applyAgentRules = async (
  home: string,
  rules: AgentRule[] = AGENT_RULES,
): Promise<Result<{ claude: string; cursor: string }, unknown>> => {
  const claude = claudePath(home);
  const cursor = cursorRulePath(home);
  const prep = await ResultAsync.fromPromise(
    Promise.all([
      mkdir(join(home, ".claude"), { recursive: true }),
      mkdir(join(home, ".cursor", "rules"), { recursive: true }),
    ]),
    (e) => e,
  );
  if (prep.isErr()) return err(prep.error);

  const file = Bun.file(claude);
  const existing = (await file.exists()) ? await file.text() : "";
  const next = upsertBlock(existing, renderRules(rules));
  const wrote = await ResultAsync.fromPromise(
    Promise.all([Bun.write(claude, next), Bun.write(cursor, renderCursorRule(rules))]),
    (e) => e,
  );
  if (wrote.isErr()) return err(wrote.error);
  return ok({ claude, cursor });
};
