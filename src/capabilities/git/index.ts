import {
  combineAsync,
  complete,
  errored,
  fromPromise,
  isComplete,
  isErrored,
  map,
  type AsyncResult,
} from "@attio/fetchable";
import { logger } from "../../utils/logger.ts";
import { errMsg } from "../../utils/errors.ts";

type GitRun = { code: number; out: string; err: string };

const run = async (...args: string[]): Promise<GitRun> => {
  const p = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { code, out: out.trim(), err: err.trim() };
};

/** git stdout on success, Errored on non-zero exit or spawn failure. */
export const git = async (...args: string[]): AsyncResult<string, unknown> => {
  const r = await fromPromise(run(...args));
  if (isErrored(r)) return r;
  const { code, out, err } = r.value;
  return code === 0 ? complete(out) : errored(new Error(err || `git ${args.join(" ")} failed`));
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

export const assertRepo = async (): AsyncResult<void, unknown> => {
  const r = await fromPromise(run("rev-parse", "--git-dir"));
  if (isErrored(r)) return r;
  return r.value.code === 0 ? complete(undefined) : errored(new Error("not a git repository"));
};

/** fetch + prune so gone/upstream state is fresh; never errors (offline, no remote — stale data is fine) */
export const fetchPrune = async () => {
  const r = await git("fetch", "--prune");
  if (isErrored(r)) logger.warn(`git fetch --prune failed: ${errMsg(r.error)}`);
};

export const defaultBranch = async (): Promise<string> => {
  const head = await fromPromise(run("symbolic-ref", "--short", "refs/remotes/origin/HEAD"));
  if (isComplete(head) && head.value.code === 0) return head.value.out.replace(/^origin\//, "");
  // If origin/HEAD isn't available, fall back to the currently checked-out branch,
  // instead of guessing common branch names like `main` / `master`.
  const cur = await fromPromise(run("symbolic-ref", "--short", "HEAD"));
  if (isComplete(cur) && cur.value.code === 0) return cur.value.out;
  return "HEAD";
};

export const listBranches = async (base: string): AsyncResult<Branch[], unknown> => {
  const fmt = [
    "%(refname:short)",
    "%(HEAD)",
    "%(committerdate:relative)",
    "%(contents:subject)",
    "%(upstream:short)",
    "%(upstream:track)",
  ].join(SEP);

  const raw = await git("for-each-ref", `--format=${fmt}`, "--sort=-committerdate", "refs/heads");
  if (isErrored(raw)) return raw;
  const mergedRaw = await fromPromise(run("branch", "--format=%(refname:short)", "--merged", base));
  const merged = new Set(
    isComplete(mergedRaw) ? mergedRaw.value.out.split("\n").filter(Boolean) : [],
  );

  return complete(
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
 * branches — one AsyncResult for the whole load, so callers check errors once.
 */
export const loadBranches = async (): AsyncResult<RepoSnapshot, unknown> => {
  const setup = await combineAsync({
    repo: assertRepo(),
    base: fromPromise(defaultBranch()),
    prune: fromPromise(fetchPrune()),
  });
  if (isErrored(setup)) return setup;
  return map(await listBranches(setup.value.base), (branches) => ({
    base: setup.value.base,
    branches,
  }));
};
