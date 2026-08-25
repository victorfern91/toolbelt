import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyToolbeltSkill, TOOLBELT_SKILL, TOOLBELT_SKILL_NAME } from "./skill.ts";
import { skillLocations } from "./skills-cli.ts";

test("bundled skill is a model-invoked toolbelt skill", () => {
  expect(TOOLBELT_SKILL).toContain("name: toolbelt");
  expect(TOOLBELT_SKILL).toContain("tb review --host");
  expect(TOOLBELT_SKILL).toContain("<<<TOOLBELT_REVIEW");
  expect(TOOLBELT_SKILL).not.toContain("disable-model-invocation");
});

test("applyToolbeltSkill writes Cursor, Claude, and agents SKILL.md", async () => {
  const home = mkdtempSync(join(tmpdir(), "tb-skill-"));
  try {
    const r = await applyToolbeltSkill(home);
    expect(r.isOk()).toBe(true);
    if (r.isErr()) return;
    const paths = skillLocations(home, TOOLBELT_SKILL_NAME);
    expect(r.value.paths).toEqual(paths);
    for (const p of paths) {
      expect(await Bun.file(p).text()).toBe(TOOLBELT_SKILL);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
