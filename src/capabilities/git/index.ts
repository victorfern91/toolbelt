import { err, ok, ResultAsync, type Result } from "neverthrow";
import { logger } from "../../utils/logger.ts";
import { errMsg } from "../../utils/errors.ts";

type GitRun = { code: number; out: string; err: string };

const run = async (...args: string[]): Promise<GitRun> => {
  const p = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, stderr, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { code, out: out.trim(), err: stderr.trim() };
};

/** git stdout on success, Err on non-zero exit or spawn failure. */
export const git = async (...args: string[]): Promise<Result<string, unknown>> => {
  const r = await ResultAsync.fromPromise(run(...args), (e) => e);
  if (r.isErr()) return err(r.error);
  const { code, out, err: stderr } = r.value;
  return code === 0 ? ok(out) : err(new Error(stderr || `git ${args.join(" ")} failed`));
};

export type Branch = {
  name: string;
  current: boolean;
  date: string;
  subject: string;
  upstream: string;
  gone: boolean;
  ahead: number;
  behind: number;
  merged: boolean;
};

const SEP = "\x1f";

export const assertRepo = async (): Promise<Result<void, unknown>> => {
  const r = await ResultAsync.fromPromise(run("rev-parse", "--git-dir"), (e) => e);
  if (r.isErr()) return err(r.error);
  return r.value.code === 0 ? ok(undefined) : err(new Error("not a git repository"));
};

/** fetch + prune so gone/upstream state is fresh; never errors (offline, no remote — stale data is fine) */
export const fetchPrune = async () => {
  const r = await git("fetch", "--prune");
  if (r.isErr()) logger.warn(`git fetch --prune failed: ${errMsg(r.error)}`);
};

export const defaultBranch = async (): Promise<string> => {
  const head = await ResultAsync.fromPromise(
    run("symbolic-ref", "--short", "refs/remotes/origin/HEAD"),
    (e) => e,
  );
  if (head.isOk() && head.value.code === 0) return head.value.out.replace(/^origin\//, "");
  // If origin/HEAD isn't available, fall back to the currently checked-out branch,
  // instead of guessing common branch names like `main` / `master`.
  const cur = await ResultAsync.fromPromise(run("symbolic-ref", "--short", "HEAD"), (e) => e);
  if (cur.isOk() && cur.value.code === 0) return cur.value.out;
  return "HEAD";
};

export const listBranches = async (base: string): Promise<Result<Branch[], unknown>> => {
  const fmt = [
    "%(refname:short)",
    "%(HEAD)",
    "%(committerdate:relative)",
    "%(contents:subject)",
    "%(upstream:short)",
    "%(upstream:track)",
  ].join(SEP);

  const raw = await git("for-each-ref", `--format=${fmt}`, "--sort=-committerdate", "refs/heads");
  if (raw.isErr()) return err(raw.error);
  const mergedRaw = await ResultAsync.fromPromise(
    run("branch", "--format=%(refname:short)", "--merged", base),
    (e) => e,
  );
  const merged = new Set(mergedRaw.isOk() ? mergedRaw.value.out.split("\n").filter(Boolean) : []);

  return ok(
    raw.value
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [name = "", head = "", date = "", subject = "", upstream = "", track = ""] =
          line.split(SEP);
        return {
          name,
          current: head === "*",
          date,
          subject,
          upstream,
          gone: track.includes("gone"),
          ahead: Number(track.match(/ahead (\d+)/)?.[1] ?? 0),
          behind: Number(track.match(/behind (\d+)/)?.[1] ?? 0),
          merged: merged.has(name),
        };
      }),
  );
};

export const deleteBranch = (name: string, force: boolean) =>
  run("branch", force ? "-D" : "-d", name);

export type RepoSnapshot = { base: string; branches: Branch[] };

/**
 * assert repo + refresh remotes + resolve default branch in parallel, then list
 * branches — one Result for the whole load, so callers check errors once.
 */
export const loadBranches = async (): Promise<Result<RepoSnapshot, unknown>> => {
  const [repo, base] = await Promise.all([assertRepo(), defaultBranch(), fetchPrune()]);
  if (repo.isErr()) return err(repo.error);
  return (await listBranches(base)).map((branches) => ({
    base,
    branches,
  }));
};
