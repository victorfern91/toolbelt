import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { applyAgentRules } from "./rules.ts";
import { npxCandidates, npxWorks, pickNpx, skillAddArgs, skillInstalledAt } from "./skills-cli.ts";
import { errMsg } from "../../utils/errors.ts";
import { ansi } from "../../ui/theme.ts";

export type Step = { name: string; ok: boolean; detail: string };

type Run = { code: number; out: string; err: string };

const run = async (cmd: string, args: string[]): Promise<Run> => {
  const p = Bun.spawn([cmd, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    cwd: homedir(),
    env: { ...process.env, CI: "1" },
  });
  const [out, stderr, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { code, out: out.trim(), err: stderr.trim() };
};

const tryRun = (cmd: string, args: string[]) => ResultAsync.fromPromise(run(cmd, args), (e) => e);

const detailOf = (r: Run) =>
  r.err.split("\n").at(-1) || r.out.split("\n").at(-1) || `exit ${r.code}`;

const findRtk = (): string | null => {
  const hits = [
    Bun.which("rtk"),
    join(homedir(), ".local", "bin", "rtk"),
    join(homedir(), ".cargo", "bin", "rtk"),
  ];
  return hits.find((p): p is string => typeof p === "string" && existsSync(p)) ?? null;
};

const isTokenKiller = async (bin: string) => {
  const r = await tryRun(bin, ["gain"]);
  return r.isOk() && r.value.code === 0;
};

const initRtk = async (bin: string): Promise<Step | null> => {
  const init = await tryRun(bin, ["init", "-g", "--auto-patch"]);
  if (init.isErr() || init.value.code !== 0) {
    return {
      name: "rtk",
      ok: false,
      detail: init.isErr() ? errMsg(init.error) : detailOf(init.value),
    };
  }
  return null;
};

const installRtk = async (verb: string): Promise<Step> => {
  const install = await tryRun("bash", [
    "-c",
    "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh",
  ]);
  if (install.isErr() || install.value.code !== 0) {
    return {
      name: "rtk",
      ok: false,
      detail: install.isErr() ? errMsg(install.error) : detailOf(install.value),
    };
  }
  const bin = findRtk();
  if (!bin) return { name: "rtk", ok: false, detail: "installed but rtk binary not on PATH" };
  const failed = await initRtk(bin);
  if (failed) return failed;
  return { name: "rtk", ok: true, detail: `${verb} (${bin})` };
};

const ensureRtk = async (mode: "setup" | "upgrade"): Promise<Step> => {
  const existing = findRtk();
  if (existing && !(await isTokenKiller(existing))) {
    return {
      name: "rtk",
      ok: false,
      detail: `${existing} is not Rust Token Killer (rtk gain failed)`,
    };
  }
  const verb = mode === "upgrade" ? "updated" : "installed";
  if (mode === "upgrade" || !existing) return installRtk(verb);
  const failed = await initRtk(existing);
  if (failed) return failed;
  return { name: "rtk", ok: true, detail: `already installed (${existing})` };
};

const addSkill = async (
  name: string,
  source: string,
  skills: readonly string[],
  verb: string,
): Promise<Step> => {
  const npx = pickNpx(npxCandidates(), npxWorks);
  if (!npx) return { name, ok: false, detail: "npx not found — install Node.js" };
  const r = await tryRun(npx, skillAddArgs(source, skills));
  const where = skillInstalledAt(homedir(), name);
  if (where) return { name, ok: true, detail: `${verb} (${where})` };
  if (r.isErr()) return { name, ok: false, detail: errMsg(r.error) };
  return { name, ok: false, detail: detailOf(r.value) };
};

const runAiStack = async (mode: "setup" | "upgrade"): Promise<Result<Step[], unknown>> => {
  const verb = mode === "upgrade" ? "updated" : "installed";
  const rules = await applyAgentRules(homedir());
  const steps: Step[] = [
    rules.isErr()
      ? { name: "rules", ok: false, detail: errMsg(rules.error) }
      : { name: "rules", ok: true, detail: `${rules.value.claude} + ${rules.value.cursor}` },
  ];
  steps.push(await ensureRtk(mode));
  steps.push(await addSkill("caveman", "JuliusBrussee/caveman", ["caveman"], verb));
  steps.push(await addSkill("grill-me", "mattpocock/skills", ["grill-me", "grilling"], verb));
  return ok(steps);
};

const printSteps = async (
  r: Result<Step[], unknown>,
  failMsg: string,
): Promise<Result<void, unknown>> => {
  if (r.isErr()) return err(r.error);
  for (const s of r.value) {
    const mark = s.ok ? `${ansi.ok}✓${ansi.reset}` : `${ansi.danger}✗${ansi.reset}`;
    console.log(`${mark} ${s.name.padEnd(10)} ${s.detail}`);
  }
  return r.value.every((s) => s.ok) ? ok(undefined) : err(new Error(failMsg));
};

export const setupAi = () => runAiStack("setup");
export const upgradeAi = () => runAiStack("upgrade");

export const printSetupAi = async () => printSteps(await setupAi(), "setup ai: some steps failed");
export const printUpgradeAi = async () =>
  printSteps(await upgradeAi(), "upgrade ai: some steps failed");
