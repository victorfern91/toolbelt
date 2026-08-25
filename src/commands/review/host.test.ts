import { expect, test } from "bun:test";
import { startReviewHost } from "./host.ts";
import type { ReviewSnapshot } from "../../capabilities/review/types.ts";

const snapshot: ReviewSnapshot = {
  root: "/tmp/demo",
  branch: "feat/review",
  base: "HEAD",
  files: [
    {
      path: "src/a.ts",
      status: "modified",
      oldContents: "export const n = 1;\n",
      newContents: "export const n = 2;\n",
    },
  ],
};

test("empty snapshot is an error before listen", async () => {
  const r = await startReviewHost({
    snapshot: { ...snapshot, files: [] },
    open: false,
  });
  expect(r.isErr()).toBe(true);
});

test("host serves the snapshot and prints a prompt on submit", async () => {
  const r = await startReviewHost({ snapshot, open: false, port: 0 });
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  const { url, stop, done } = r.value;
  try {
    const page = await fetch(url);
    expect(page.ok).toBe(true);
    const loaded = await fetch(`${url}/api/snapshot`).then((res) => res.json());
    expect(loaded.files[0].path).toBe("src/a.ts");
    const res = await fetch(`${url}/api/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notes: "look at a.ts",
        files: [{ path: "src/a.ts", verdict: "unapproved" }],
        comments: [
          {
            id: "c1",
            path: "src/a.ts",
            side: "additions",
            startLine: 1,
            endLine: 1,
            body: "keep n = 1",
          },
        ],
        edits: [],
      }),
    });
    expect(res.ok).toBe(true);
    const prompt = await done;
    expect(prompt).toContain("<<<TOOLBELT_REVIEW");
    expect(prompt).toContain("keep n = 1");
    expect(prompt).toContain("`src/a.ts`");
  } finally {
    stop();
  }
});
