// ponytail: one smoke test — fixture repo + one render. Fails if git parsing or the UI breaks.
import { expect, test, beforeAll, afterAll } from "bun:test";
import { render } from "ink-testing-library";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultBranch,
  listBranches,
  resolveBranch,
  switchBranch,
  type Branch,
} from "./src/capabilities/git/index.ts";
import { BranchCleaner } from "./src/commands/branch-cleaner/command.tsx";
import { Switch } from "./src/commands/switch/command.tsx";

const cwd = process.cwd();
let repo: string;

const sh = (cmd: string) => Bun.spawnSync(["bash", "-c", cmd], { cwd: repo }).exitCode;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "toolbelt-"));
  sh(
    `git init -q -b main && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init &&
     git branch done-branch &&
     git checkout -q -b wip && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m wip &&
     git checkout -q main`,
  );
  process.chdir(repo);
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(repo, { recursive: true, force: true });
});

test("branches are classified", async () => {
  const base = await defaultBranch();
  expect(base).toBe("main");
  const byName = Object.fromEntries(
    (await listBranches(base)).unwrapOr([] as Branch[]).map((b) => [b.name, b]),
  );
  expect(byName["main"]?.current).toBe(true);
  expect(byName["done-branch"]?.merged).toBe(true);
  expect(byName["wip"]?.merged).toBe(false);
  expect(byName["wip"]?.gone).toBe(false);
});

test("UI renders the branch list", async () => {
  const { lastFrame, unmount } = render(<BranchCleaner />);
  await Bun.sleep(300);
  const frame = lastFrame() ?? "";
  unmount();
  expect(frame).toContain("branch-cleaner");
  expect(frame).toContain("done-branch");
  expect(frame).toContain("merged");
  expect(frame).toContain("current");
});

test("UI renders the switch list", async () => {
  const { lastFrame, unmount } = render(<Switch />);
  await Bun.sleep(300);
  const frame = lastFrame() ?? "";
  unmount();
  expect(frame).toContain("switch");
  expect(frame).toContain("done-branch");
  expect(frame).toContain("wip");
});

test("switch checks out a local branch", async () => {
  expect(resolveBranch("wip", ["main", "wip", "done-branch"])).toBe("wip");
  const r = await switchBranch("wip");
  expect(r.isOk()).toBe(true);
  const cur = Bun.spawnSync(["git", "branch", "--show-current"], { cwd: repo });
  expect(cur.stdout.toString().trim()).toBe("wip");
  await switchBranch("main");
});

test("switch creates local branch from remote", async () => {
  const bare = mkdtempSync(join(tmpdir(), "toolbelt-bare-"));
  try {
    expect(sh(`git clone -q --bare "${repo}" "${bare}"`)).toBe(0);
    expect(sh(`git remote add origin "${bare}"`)).toBe(0);
    expect(sh(`git push -q -u origin wip:remote-only`)).toBe(0);
    expect(sh(`git branch -D remote-only 2>/dev/null; true`)).toBe(0);

    const { switchFromRemote } = await import("./src/capabilities/git/index.ts");
    const r = await switchFromRemote("remote-only");
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toBe("remote-only");
    const cur = Bun.spawnSync(["git", "branch", "--show-current"], { cwd: repo });
    expect(cur.stdout.toString().trim()).toBe("remote-only");
    await switchBranch("main");
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

test("version compare", async () => {
  const { isNewer } = await import("./src/update.ts");
  expect(isNewer("v0.2.0", "0.1.0")).toBe(true);
  expect(isNewer("v0.1.1", "0.1.0")).toBe(true);
  expect(isNewer("v1.0.0", "0.9.9")).toBe(true);
  expect(isNewer("v0.1.0", "0.1.0")).toBe(false);
  expect(isNewer("v0.1.0", "0.2.0")).toBe(false);
  expect(isNewer("v0.10.0", "0.9.0")).toBe(true);
  expect(isNewer("v0.2.0-beta.1", "0.1.0")).toBe(true);
  expect(isNewer("v0.1.0-beta.1", "0.1.0")).toBe(false);
});
