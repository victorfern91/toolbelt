import { expect, test } from "bun:test";
import { parseFeedback, renderReviewPrompt, wrapReviewPrompt } from "./prompt.ts";
import type { ReviewSnapshot } from "./types.ts";

const snapshot: ReviewSnapshot = {
  root: "/tmp/demo",
  branch: "feat/review",
  base: "HEAD",
  files: [
    {
      path: "src/ok.ts",
      status: "modified",
      oldContents: "export const n = 1;\n",
      newContents: "export const n = 2;\n",
    },
    {
      path: "src/bad.ts",
      status: "modified",
      oldContents: "export const leak = true;\n",
      newContents: "export const leak = false;\nconst token = 'secret';\n",
    },
  ],
};

test("parseFeedback rejects junk", () => {
  expect(parseFeedback(null).isErr()).toBe(true);
  expect(parseFeedback({ files: [{ path: "a", verdict: "nope" }] }).isErr()).toBe(true);
});

test("parseFeedback drops empty comments", () => {
  const r = parseFeedback({
    notes: "look again",
    files: [{ path: "src/bad.ts", verdict: "unapproved" }],
    comments: [
      { id: "1", path: "src/bad.ts", side: "additions", startLine: 2, endLine: 2, body: "  " },
      {
        id: "2",
        path: "src/bad.ts",
        side: "additions",
        startLine: 2,
        endLine: 2,
        body: "don't hardcode secrets",
      },
    ],
    edits: [{ path: "src/ok.ts", contents: "export const n = 3;\n" }],
  });
  expect(r.isOk()).toBe(true);
  if (r.isErr()) return;
  expect(r.value.comments).toHaveLength(1);
  expect(r.value.comments[0]?.body).toBe("don't hardcode secrets");
});

test("renderReviewPrompt includes unapproved locations and excerpts", () => {
  const feedback = parseFeedback({
    notes: "token handling is wrong",
    files: [
      { path: "src/ok.ts", verdict: "approved" },
      { path: "src/bad.ts", verdict: "unapproved" },
    ],
    comments: [
      {
        id: "c1",
        path: "src/bad.ts",
        side: "additions",
        startLine: 2,
        endLine: 2,
        body: "don't hardcode secrets",
      },
    ],
    edits: [],
  });
  expect(feedback.isOk()).toBe(true);
  if (feedback.isErr()) return;
  const prompt = renderReviewPrompt(snapshot, feedback.value);
  expect(prompt).toContain("Unapproved");
  expect(prompt).toContain("`src/bad.ts`");
  expect(prompt).toContain("additions L2");
  expect(prompt).toContain("don't hardcode secrets");
  expect(prompt).toContain("const token = 'secret';");
  expect(prompt).toContain("`src/ok.ts` (modified)");
  expect(prompt).toContain("token handling is wrong");
  expect(wrapReviewPrompt(prompt)).toContain("<<<TOOLBELT_REVIEW");
});
