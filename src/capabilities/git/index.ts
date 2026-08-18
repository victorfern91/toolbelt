const run = async (...args: string[]) => {
  const p = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
  ]);
  return { code: await p.exited, out: out.trim(), err: err.trim() };
};

export const git = async (...args: string[]) => {
  const r = await run(...args);
  if (r.code !== 0) throw new Error(r.err || `git ${args.join(" ")} failed`);
  return r.out;
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

export async function assertRepo() {
  const r = await run("rev-parse", "--git-dir");
  if (r.code !== 0) throw new Error("not a git repository");
}

export async function defaultBranch() {
  const r = await run("symbolic-ref", "--short", "refs/remotes/origin/HEAD");
  if (r.code === 0) return r.out.replace(/^origin\//, "");
  // ponytail: no origin/HEAD -> guess by convention
  for (const n of ["main", "master", "develop"]) {
    if ((await run("rev-parse", "--verify", n)).code === 0) return n;
  }
  return "HEAD";
}

export async function listBranches(base: string): Promise<Branch[]> {
  const fmt = [
    "%(refname:short)",
    "%(HEAD)",
    "%(committerdate:relative)",
    "%(contents:subject)",
    "%(upstream:short)",
    "%(upstream:track)",
  ].join(SEP);

  const raw = await git(
    "for-each-ref",
    `--format=${fmt}`,
    "--sort=-committerdate",
    "refs/heads",
  );
  const mergedRaw = await run("branch", "--format=%(refname:short)", "--merged", base);
  const merged = new Set(mergedRaw.out.split("\n").filter(Boolean));

  return raw
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
    });
}

export const deleteBranch = (name: string, force: boolean) =>
  run("branch", force ? "-D" : "-d", name);
