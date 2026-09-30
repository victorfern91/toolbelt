import { expect, test } from "bun:test";
import { startSolveHost } from "./host.ts";
import type { ConflictSnapshot } from "../../capabilities/solve/types.ts";

const snapshot: ConflictSnapshot = {
  root: "/tmp/demo",
  op: "rebase",
  oursLabel: "main",
  theirsLabel: "feature",
  files: [
    {
      path: "Book.java",
      base: "int pages) {\n",
      ours: "int pages,\nboolean illustrated) {\n",
      theirs: "int pages,\nint weight) {\n",
    },
  ],
};

test("empty snapshot is an error before listen", async () => {
  const r = await startSolveHost({
    snapshot: { ...snapshot, files: [] },
    open: false,
  });
  expect(r.isErr()).toBe(true);
});

test("host serves the snapshot", async () => {
  const r = await startSolveHost({ snapshot, open: false, port: 0 });
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  const { url, stop } = r.value;
  try {
    const page = await fetch(url);
    expect(page.ok).toBe(true);
    const loaded = (await fetch(`${url}/api/snapshot`).then((res) =>
      res.json(),
    )) as ConflictSnapshot;
    expect(loaded.files[0]?.path).toBe("Book.java");
    expect(loaded.oursLabel).toBe("main");
    expect(loaded.op).toBe("rebase");
  } finally {
    stop();
  }
});

test("abandon finishes the host", async () => {
  const r = await startSolveHost({ snapshot, open: false, port: 0 });
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  const { url, stop, done } = r.value;
  try {
    const res = await fetch(`${url}/api/abandon`, { method: "POST" });
    expect(res.status).toBe(204);
    expect(await done).toBe("abandoned");
  } finally {
    stop();
  }
});

test("apply rejects invalid bodies", async () => {
  const r = await startSolveHost({ snapshot, open: false, port: 0 });
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  const { url, stop } = r.value;
  try {
    const res = await fetch(`${url}/api/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: [{ path: "Book.java" }] }),
    });
    expect(res.status).toBe(400);
  } finally {
    stop();
  }
});
