import { existsSync } from "node:fs";
import { join } from "node:path";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { assertRepo, git } from "../git/index.ts";
import { errMsg } from "../../utils/errors.ts";
import type { ApplyFile, ConflictFile, ConflictOp, ConflictSnapshot, SkipReason } from "./types.ts";

const MAX_BYTES = 512 * 1024;

type GitRun = { code: number; out: string; err: string };

const runAt = async (cwd: string, ...args: string[]): Promise<GitRun> => {
  const p = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [out, stderr, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { code, out, err: stderr.trim() };
};

const skipReason = (contents: string): SkipReason | undefined => {
  if (contents.includes("\0")) return "binary";
  if (Buffer.byteLength(contents) > MAX_BYTES) return "too-large";
  return undefined;
};

const showStage = async (root: string, stage: 1 | 2 | 3, path: string): Promise<string | null> => {
  const r = await ResultAsync.fromPromise(runAt(root, "show", `:${stage}:${path}`), (e) => e);
  if (r.isErr() || r.value.code !== 0) return null;
  if (skipReason(r.value.out)) return null;
  return r.value.out;
};

const stripRef = (raw: string) =>
  raw
    .trim()
    .replace(/^(remotes\/|refs\/heads\/|refs\/remotes\/|refs\/tags\/|heads\/)/, "")
    .replace(/^origin\//, "");

const nameOf = async (root: string, rev: string): Promise<string> => {
  const named = await runAt(root, "name-rev", "--name-only", "--no-undefined", rev);
  if (named.code === 0 && named.out && !named.out.includes("~") && named.out !== "undefined") {
    return stripRef(named.out);
  }
  const short = await runAt(root, "rev-parse", "--short", rev);
  return short.code === 0 ? short.out.trim() : rev;
};

const detectOp = async (root: string): Promise<ConflictOp | null> => {
  const gitDir = await runAt(root, "rev-parse", "--git-dir");
  if (gitDir.code !== 0) return null;
  const dir = gitDir.out.trim();
  const abs = dir.startsWith("/") ? dir : join(root, dir);
  if (existsSync(join(abs, "rebase-merge")) || existsSync(join(abs, "rebase-apply")))
    return "rebase";
  if (existsSync(join(abs, "CHERRY_PICK_HEAD"))) return "cherry-pick";
  if (existsSync(join(abs, "REVERT_HEAD"))) return "revert";
  if (existsSync(join(abs, "MERGE_HEAD"))) return "merge";
  return null;
};

const labelsFor = async (
  root: string,
  op: ConflictOp,
): Promise<{ oursLabel: string; theirsLabel: string }> => {
  if (op === "merge") {
    const ours = await runAt(root, "branch", "--show-current");
    return {
      oursLabel: ours.out.trim() || "HEAD",
      theirsLabel: await nameOf(root, "MERGE_HEAD"),
    };
  }
  if (op === "rebase") {
    const gitDir = (await runAt(root, "rev-parse", "--git-dir")).out.trim();
    const abs = gitDir.startsWith("/") ? gitDir : join(root, gitDir);
    const onto = Bun.file(join(abs, "rebase-merge", "onto"));
    const headName = Bun.file(join(abs, "rebase-merge", "head-name"));
    const ontoSha = (await onto.exists()) ? (await onto.text()).trim() : "";
    const branch = (await headName.exists())
      ? stripRef(await headName.text())
      : (await runAt(root, "branch", "--show-current")).out.trim();
    return {
      oursLabel: ontoSha ? await nameOf(root, ontoSha) : "onto",
      theirsLabel: branch || "HEAD",
    };
  }
  if (op === "cherry-pick") {
    const ours = await runAt(root, "branch", "--show-current");
    return {
      oursLabel: ours.out.trim() || "HEAD",
      theirsLabel: await nameOf(root, "CHERRY_PICK_HEAD"),
    };
  }
  const ours = await runAt(root, "branch", "--show-current");
  return {
    oursLabel: ours.out.trim() || "HEAD",
    theirsLabel: await nameOf(root, "REVERT_HEAD"),
  };
};

const parseUnmerged = (raw: string): string[] => {
  const paths = new Set<string>();
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    paths.add(line.slice(tab + 1));
  }
  return [...paths];
};

const loadFile = async (root: string, path: string): Promise<ConflictFile> => {
  const [base, ours, theirs] = await Promise.all([
    showStage(root, 1, path),
    showStage(root, 2, path),
    showStage(root, 3, path),
  ]);
  const samples = [base, ours, theirs].filter((s): s is string => s != null);
  const skipped = samples.map(skipReason).find(Boolean);
  return {
    path,
    base: skipped ? null : base,
    ours: skipped ? null : ours,
    theirs: skipped ? null : theirs,
    ...(skipped ? { skipped } : {}),
  };
};

export const collectConflicts = async (): Promise<Result<ConflictSnapshot, unknown>> => {
  const repo = await assertRepo();
  if (repo.isErr()) return err(repo.error);

  const rootR = await git("rev-parse", "--show-toplevel");
  if (rootR.isErr()) return err(rootR.error);
  const root = rootR.value;

  const op = await detectOp(root);
  if (!op) return err(new Error("no in-progress merge, rebase, cherry-pick, or revert"));

  const unmerged = await runAt(root, "ls-files", "-u");
  if (unmerged.code !== 0) return err(new Error(unmerged.err || "git ls-files -u failed"));
  const paths = parseUnmerged(unmerged.out);
  if (!paths.length) return err(new Error("no remaining conflicts"));

  const [files, labels] = await Promise.all([
    Promise.all(paths.map((path) => loadFile(root, path))),
    labelsFor(root, op),
  ]);

  return ok({
    root,
    op,
    oursLabel: labels.oursLabel,
    theirsLabel: labels.theirsLabel,
    files,
  });
};

export const applyResolutions = async (
  root: string,
  files: ApplyFile[],
): Promise<Result<{ remaining: string[] }, unknown>> => {
  for (const file of files) {
    const abs = join(root, file.path);
    if (file.contents == null) {
      const rm = await runAt(root, "rm", "-f", "--", file.path);
      if (rm.code !== 0) {
        try {
          await Bun.file(abs).unlink();
        } catch {
          // already gone
        }
        const add = await runAt(root, "add", "-u", "--", file.path);
        if (add.code !== 0) return err(new Error(add.err || `git add ${file.path} failed`));
      }
      continue;
    }
    try {
      await Bun.write(abs, file.contents);
    } catch (e) {
      return err(new Error(`write ${file.path}: ${errMsg(e)}`));
    }
    const add = await runAt(root, "add", "--", file.path);
    if (add.code !== 0) return err(new Error(add.err || `git add ${file.path} failed`));
  }
  const unmerged = await runAt(root, "ls-files", "-u");
  if (unmerged.code !== 0) return err(new Error(unmerged.err || "git ls-files -u failed"));
  return ok({ remaining: parseUnmerged(unmerged.out) });
};
