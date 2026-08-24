import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

/** Agents whose global dirs Cursor and Claude actually load. */
export const SKILL_AGENTS = ["claude-code", "cursor"] as const;

export const skillAddArgs = (source: string, skills: readonly string[]): string[] => [
  "-y",
  "skills@latest",
  "add",
  source,
  ...skills.flatMap((s) => ["--skill", s]),
  "-g",
  "-y",
  ...SKILL_AGENTS.flatMap((a) => ["-a", a]),
];

export const skillLocations = (home: string, name: string): string[] => [
  join(home, ".agents", "skills", name, "SKILL.md"),
  join(home, ".cursor", "skills", name, "SKILL.md"),
  join(home, ".claude", "skills", name, "SKILL.md"),
];

export const skillInstalledAt = (home: string, name: string): string | null =>
  skillLocations(home, name).find((p) => existsSync(p)) ?? null;

/** grill-me is a shim; grilling must be present too. Check every requested skill. */
export const skillsInstalledAt = (
  home: string,
  skills: readonly string[],
): { ok: true; where: string } | { ok: false; missing: string[] } => {
  const missing = skills.filter((s) => !skillInstalledAt(home, s));
  if (missing.length) return { ok: false, missing };
  return { ok: true, where: skillInstalledAt(home, skills[0]!)! };
};

/** npx is `#!/usr/bin/env node` — put its bin dir first so node resolves without a login shell. */
export const npxEnv = (bin: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => ({
  ...base,
  PATH: `${dirname(bin)}${delimiter}${base.PATH ?? ""}`,
});

const asdfNpxInstalls = (home: string): string[] => {
  const root = join(home, ".asdf", "installs", "nodejs");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((v) => v !== "latests")
    .sort()
    .toReversed()
    .map((v) => join(root, v, "bin", "npx"));
};

export const npxCandidates = (home = homedir(), which = Bun.which("npx")): string[] =>
  [
    which,
    "/opt/homebrew/bin/npx",
    "/usr/local/bin/npx",
    join(home, ".volta", "bin", "npx"),
    ...asdfNpxInstalls(home),
  ].filter((p): p is string => typeof p === "string");

export const pickNpx = (candidates: string[], usable: (bin: string) => boolean): string | null =>
  candidates.find(usable) ?? null;

export const npxWorks = (bin: string): boolean => {
  if (!existsSync(bin)) return false;
  const r = Bun.spawnSync([bin, "--version"], {
    stdout: "pipe",
    stderr: "pipe",
    env: npxEnv(bin),
  });
  return r.exitCode === 0;
};
