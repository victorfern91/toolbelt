import { expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyResolutions, collectConflicts } from "./snapshot.ts";

const cwd = process.cwd();
let repo: string;

const sh = (cmd: string) => {
  const r = Bun.spawnSync(["bash", "-c", cmd], { cwd: repo });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString() || r.stdout.toString() || cmd);
  return r.stdout.toString();
};

const baseBook = `public record Book(String title,
  List<String> authors,
  String publisher,
  LocalDate publicationDate,
  String isbn,
  int pages) {

  public boolean containsAuthor(String author) {
    return authors.contains(author);
  }
}
`;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "tb-solve-"));
  process.chdir(repo);
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(repo, { recursive: true, force: true });
});

beforeEach(() => {
  sh("rm -rf .git Book.java && git init -q -b main");
  sh("git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init");
});

test("collectConflicts errors when idle", async () => {
  const r = await collectConflicts();
  expect(r.isErr()).toBe(true);
  expect(String(r.isErr() ? r.error : "")).toContain("no in-progress");
});

test("collectConflicts reads a merge of Book.java", async () => {
  sh(`cat > Book.java << 'EOF'
${baseBook}EOF
git add Book.java && git -c user.email=t@t -c user.name=t commit -q -m book`);
  sh(`git checkout -q -b feature
python3 - << 'PY'
from pathlib import Path
p = Path("Book.java")
p.write_text(p.read_text().replace("  int pages) {", "  int pages,\\n  int weight) {"))
PY
git add Book.java && git -c user.email=t@t -c user.name=t commit -q -m weight`);
  sh(`git checkout -q main
python3 - << 'PY'
from pathlib import Path
p = Path("Book.java")
p.write_text(p.read_text().replace("  int pages) {", "  int pages,\\n  boolean illustrated) {"))
PY
git add Book.java && git -c user.email=t@t -c user.name=t commit -q -m illustrated`);
  // git merge refuses to start without a committer ident, even when the
  // result will be a conflict. CI hosts cannot auto-detect one.
  const merge = Bun.spawnSync(
    ["git", "-c", "user.email=t@t", "-c", "user.name=t", "merge", "--no-ff", "feature"],
    { cwd: repo },
  );
  expect(merge.exitCode).not.toBe(0);

  const r = await collectConflicts();
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  expect(r.value.op).toBe("merge");
  expect(r.value.oursLabel).toBe("main");
  expect(r.value.theirsLabel).toContain("feature");
  expect(r.value.files).toHaveLength(1);
  const file = r.value.files[0]!;
  expect(file.path).toBe("Book.java");
  expect(file.ours).toContain("illustrated");
  expect(file.theirs).toContain("weight");
  expect(file.base).toContain("int pages) {");
});

test("applyResolutions stages the file and clears it from unmerged", async () => {
  sh(`printf 'base\\n' > f.txt && git add f.txt && git -c user.email=t@t -c user.name=t commit -q -m base
git checkout -q -b other
printf 'theirs\\n' > f.txt && git add f.txt && git -c user.email=t@t -c user.name=t commit -q -m theirs
git checkout -q main
printf 'ours\\n' > f.txt && git add f.txt && git -c user.email=t@t -c user.name=t commit -q -m ours`);
  expect(
    Bun.spawnSync(["git", "-c", "user.email=t@t", "-c", "user.name=t", "merge", "other"], {
      cwd: repo,
    }).exitCode,
  ).not.toBe(0);

  const applied = await applyResolutions(repo, [{ path: "f.txt", contents: "ours\n" }]);
  expect(applied.isOk()).toBe(true);
  if (applied.isErr()) return;
  expect(applied.value.remaining).toEqual([]);
  expect(await Bun.file(join(repo, "f.txt")).text()).toBe("ours\n");
  const unmerged = Bun.spawnSync(["git", "ls-files", "-u"], { cwd: repo });
  expect(unmerged.stdout.toString().trim()).toBe("");
});

test("collectConflicts reads a rebase conflict", async () => {
  sh(`printf 'base\\n' > f.txt && git add f.txt && git -c user.email=t@t -c user.name=t commit -q -m base
git checkout -q -b feature
printf 'feature\\n' > f.txt && git add f.txt && git -c user.email=t@t -c user.name=t commit -q -m feature
git checkout -q main
printf 'main\\n' > f.txt && git add f.txt && git -c user.email=t@t -c user.name=t commit -q -m main
git checkout -q feature`);
  expect(Bun.spawnSync(["git", "rebase", "main"], { cwd: repo }).exitCode).not.toBe(0);

  const r = await collectConflicts();
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  expect(r.value.op).toBe("rebase");
  expect(r.value.oursLabel).toBe("main");
  expect(r.value.theirsLabel).toBe("feature");
  expect(r.value.files[0]?.ours).toBe("main\n");
  expect(r.value.files[0]?.theirs).toBe("feature\n");
});
