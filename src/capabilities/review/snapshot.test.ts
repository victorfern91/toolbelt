import { expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectSnapshot } from "./snapshot.ts";

const cwd = process.cwd();
let repo: string;

const sh = (cmd: string) => {
  const r = Bun.spawnSync(["bash", "-c", cmd], { cwd: repo });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString() || cmd);
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "tb-review-"));
  sh(
    `git init -q -b main &&
     git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init &&
     printf 'hello\\n' > keep.ts &&
     printf 'old\\n' > gone.ts &&
     printf 'from\\n' > renamed.ts &&
     git add keep.ts gone.ts renamed.ts &&
     git -c user.email=t@t -c user.name=t commit -q -m files`,
  );
  sh(
    `printf 'hello world\\n' > keep.ts &&
     rm gone.ts &&
     git mv renamed.ts moved.ts &&
     printf 'fresh\\n' > extra.ts`,
  );
  process.chdir(repo);
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(repo, { recursive: true, force: true });
});

test("collectSnapshot captures modified, deleted, renamed, and untracked files", async () => {
  const r = await collectSnapshot();
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  const byPath = Object.fromEntries(r.value.files.map((f) => [f.path, f]));
  expect(r.value.branch).toBe("main");
  expect(r.value.base).toBe("HEAD");

  expect(byPath["keep.ts"]?.status).toBe("modified");
  expect(byPath["keep.ts"]?.oldContents).toBe("hello\n");
  expect(byPath["keep.ts"]?.newContents).toBe("hello world\n");

  expect(byPath["gone.ts"]?.status).toBe("deleted");
  expect(byPath["gone.ts"]?.oldContents).toBe("old\n");
  expect(byPath["gone.ts"]?.newContents).toBeNull();

  expect(byPath["moved.ts"]?.status).toBe("renamed");
  expect(byPath["moved.ts"]?.oldPath).toBe("renamed.ts");
  expect(byPath["moved.ts"]?.oldContents).toBe("from\n");
  expect(byPath["moved.ts"]?.newContents).toBe("from\n");

  expect(byPath["extra.ts"]?.status).toBe("untracked");
  expect(byPath["extra.ts"]?.oldContents).toBeNull();
  expect(byPath["extra.ts"]?.newContents).toBe("fresh\n");
});
