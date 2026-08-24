import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  npxCandidates,
  npxEnv,
  npxWorks,
  pickNpx,
  skillAddArgs,
  skillInstalledAt,
  skillLocations,
  skillsInstalledAt,
} from "./skills-cli.ts";

test("skill add argv is global, non-interactive, and names the skills", () => {
  expect(skillAddArgs("JuliusBrussee/caveman", ["caveman"])).toEqual([
    "-y",
    "skills@latest",
    "add",
    "JuliusBrussee/caveman",
    "--skill",
    "caveman",
    "-g",
    "-y",
    "-a",
    "claude-code",
    "-a",
    "cursor",
  ]);
  expect(skillAddArgs("mattpocock/skills", ["grill-me", "grilling"])).toContain("-g");
  expect(skillAddArgs("mattpocock/skills", ["grill-me", "grilling"])).not.toContain("--all");
});

test("skillInstalledAt finds Cursor/Claude/agents global SKILL.md", () => {
  const home = mkdtempSync(join(tmpdir(), "tb-skills-"));
  try {
    expect(skillInstalledAt(home, "caveman")).toBeNull();
    const dest = join(home, ".cursor", "skills", "caveman");
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, "SKILL.md"), "# caveman\n");
    expect(skillInstalledAt(home, "caveman")).toBe(join(dest, "SKILL.md"));
    expect(skillLocations(home, "caveman")).toHaveLength(3);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("skillsInstalledAt requires every skill including grilling for grill-me", () => {
  const home = mkdtempSync(join(tmpdir(), "tb-skills-"));
  try {
    const grillMe = join(home, ".agents", "skills", "grill-me");
    mkdirSync(grillMe, { recursive: true });
    writeFileSync(join(grillMe, "SKILL.md"), "# grill-me\n");
    expect(skillsInstalledAt(home, ["grill-me", "grilling"])).toEqual({
      ok: false,
      missing: ["grilling"],
    });

    const grilling = join(home, ".agents", "skills", "grilling");
    mkdirSync(grilling, { recursive: true });
    writeFileSync(join(grilling, "SKILL.md"), "# grilling\n");
    expect(skillsInstalledAt(home, ["grill-me", "grilling"])).toEqual({
      ok: true,
      where: join(grillMe, "SKILL.md"),
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("pickNpx skips binaries that do not actually run", () => {
  expect(pickNpx(["/missing/npx", "/also/missing"], () => false)).toBeNull();
  expect(pickNpx(["/missing/npx", "/opt/homebrew/bin/npx"], (p) => p.includes("homebrew"))).toBe(
    "/opt/homebrew/bin/npx",
  );
});

test("npxCandidates prefer PATH then well-known prefixes", () => {
  const home = "/Users/me";
  const hits = npxCandidates(home, "/Users/me/.asdf/shims/npx");
  expect(hits[0]).toBe("/Users/me/.asdf/shims/npx");
  expect(hits).toContain("/opt/homebrew/bin/npx");
});

test("npxEnv puts npx's bin dir first so #!/usr/bin/env node resolves", () => {
  const bin = "/opt/homebrew/bin/npx";
  const env = npxEnv(bin, { PATH: "/usr/bin:/bin" });
  expect(env.PATH?.startsWith(`${dirname(bin)}:`)).toBe(true);
});

test("npxWorks finds homebrew/asdf npx when node is only beside it", () => {
  const npx = pickNpx(npxCandidates(), npxWorks);
  // Machine has Node via Homebrew or asdf installs; without npxEnv this used to be null.
  expect(npx).not.toBeNull();
  expect(npxWorks(npx!)).toBe(true);
});
