// ponytail: one smoke test — fixture repo + one render. Fails if git parsing or the UI breaks.
import { expect, test, beforeAll, afterAll } from "bun:test";
import { render } from "ink-testing-library";
import { valueOrElse } from "@attio/fetchable";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultBranch, listBranches, type Branch } from "./src/capabilities/git/index.ts";
import { BranchCleaner } from "./src/commands/branch-cleaner/command.tsx";

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
    valueOrElse(await listBranches(base), [] as Branch[]).map((b) => [b.name, b]),
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

test("version compare", async () => {
  const { isNewer } = await import("./src/update.ts");
  expect(isNewer("v0.2.0", "0.1.0")).toBe(true);
  expect(isNewer("v0.1.1", "0.1.0")).toBe(true);
  expect(isNewer("v1.0.0", "0.9.9")).toBe(true);
  expect(isNewer("v0.1.0", "0.1.0")).toBe(false);
  expect(isNewer("v0.1.0", "0.2.0")).toBe(false);
  expect(isNewer("v0.10.0", "0.9.0")).toBe(true);
});
