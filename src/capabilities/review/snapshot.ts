import { join } from "node:path";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { assertRepo, git } from "../git/index.ts";
import type { FileStatus, ReviewFile, ReviewSnapshot, SkipReason } from "./types.ts";

const MAX_BYTES = 512 * 1024;

type GitRun = { code: number; out: string; err: string };

const show = async (cwd: string, spec: string): Promise<GitRun> => {
  const p = Bun.spawn(["git", "show", spec], { cwd, stdout: "pipe", stderr: "pipe" });
  const [out, stderr, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { code, out, err: stderr.trim() };
};

const statusOf = (code: string): FileStatus => {
  const c = code[0];
  if (c === "A") return "added";
  if (c === "D") return "deleted";
  if (c === "R") return "renamed";
  return "modified";
};

const parseNameStatus = (
  raw: string,
): Array<{ status: FileStatus; path: string; oldPath?: string }> => {
  const parts = raw.split("\0");
  const out: Array<{ status: FileStatus; path: string; oldPath?: string }> = [];
  let i = 0;
  while (i < parts.length) {
    const token = parts[i];
    if (!token) {
      i += 1;
      continue;
    }
    const status = statusOf(token);
    if (token[0] === "R" || token[0] === "C") {
      const oldPath = parts[i + 1];
      const path = parts[i + 2];
      i += 3;
      if (oldPath && path)
        out.push({ status: token[0] === "R" ? "renamed" : "added", path, oldPath });
      continue;
    }
    const path = parts[i + 1];
    i += 2;
    if (path) out.push({ status, path });
  }
  return out;
};

const skipReason = (contents: string): SkipReason | undefined => {
  if (contents.includes("\0")) return "binary";
  if (Buffer.byteLength(contents) > MAX_BYTES) return "too-large";
  return undefined;
};

const readWorktree = async (
  root: string,
  path: string,
): Promise<{ text: string | null; skipped?: SkipReason }> => {
  const file = Bun.file(join(root, path));
  if (!(await file.exists())) return { text: null };
  if (file.size > MAX_BYTES) return { text: null, skipped: "too-large" };
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.includes(0)) return { text: null, skipped: "binary" };
  const text = new TextDecoder().decode(buf);
  return { text };
};

const readHead = async (
  root: string,
  path: string,
): Promise<{ text: string | null; skipped?: SkipReason }> => {
  const r = await ResultAsync.fromPromise(show(root, `HEAD:${path}`), (e) => e);
  if (r.isErr() || r.value.code !== 0) return { text: null };
  const skipped = skipReason(r.value.out);
  if (skipped) return { text: null, skipped };
  return { text: r.value.out };
};

const loadFile = async (
  root: string,
  row: { status: FileStatus; path: string; oldPath?: string },
): Promise<ReviewFile> => {
  const headPath = row.oldPath ?? row.path;
  const [head, work] = await Promise.all([
    row.status === "added" || row.status === "untracked"
      ? Promise.resolve({ text: null } as { text: string | null; skipped?: SkipReason })
      : readHead(root, headPath),
    row.status === "deleted"
      ? Promise.resolve({ text: null as string | null })
      : readWorktree(root, row.path),
  ]);
  const skipped = head.skipped ?? work.skipped;
  return {
    path: row.path,
    status: row.status,
    ...(row.oldPath ? { oldPath: row.oldPath } : {}),
    oldContents: skipped ? null : head.text,
    newContents: skipped ? null : (work.text ?? null),
    ...(skipped ? { skipped } : {}),
  };
};

export const collectSnapshot = async (): Promise<Result<ReviewSnapshot, unknown>> => {
  const repo = await assertRepo();
  if (repo.isErr()) return err(repo.error);

  const rootR = await git("rev-parse", "--show-toplevel");
  if (rootR.isErr()) return err(rootR.error);
  const root = rootR.value;

  const [branchR, namesR, untrackedR] = await Promise.all([
    git("branch", "--show-current"),
    git("diff", "--name-status", "-z", "HEAD"),
    git("ls-files", "-z", "--others", "--exclude-standard"),
  ]);
  if (namesR.isErr()) return err(namesR.error);
  if (untrackedR.isErr()) return err(untrackedR.error);

  const tracked = parseNameStatus(namesR.value);
  const seen = new Set(tracked.map((f) => f.path));
  const untracked = untrackedR.value
    .split("\0")
    .filter((p) => p && !seen.has(p))
    .map((path) => ({ status: "untracked" as const, path }));

  const files = await Promise.all([...tracked, ...untracked].map((row) => loadFile(root, row)));
  const branch =
    branchR.isOk() && branchR.value
      ? branchR.value
      : ((await git("rev-parse", "--short", "HEAD")).unwrapOr("HEAD") as string);

  return ok({ root, branch, base: "HEAD", files });
};
