import { expect, test } from "bun:test";
import {
  hasActionableFeedback,
  parseFeedback,
  renderReviewPrompt,
  wrapReviewPrompt,
} from "./prompt.ts";
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
    {
      path: "src/other.ts",
      status: "added",
      oldContents: null,
      newContents: "export {};\n",
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

test("hasActionableFeedback is false when everything is pending", () => {
  expect(
    hasActionableFeedback({
      notes: "",
      files: [
        { path: "src/ok.ts", verdict: "pending" },
        { path: "src/bad.ts", verdict: "pending" },
      ],
      comments: [],
      edits: [],
    }),
  ).toBe(false);
  expect(
    hasActionableFeedback({
      notes: "",
      files: [{ path: "src/bad.ts", verdict: "unapproved" }],
      comments: [],
      edits: [],
    }),
  ).toBe(true);
});

test("renderReviewPrompt is dense RTK-style", () => {
  const feedback = parseFeedback({
    notes: "token handling is wrong",
    files: [
      { path: "src/ok.ts", verdict: "approved" },
      { path: "src/bad.ts", verdict: "unapproved" },
      { path: "src/other.ts", verdict: "pending" },
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
  expect(prompt).toBe(
    [
      "ok: src/ok.ts",
      "fix: src/bad.ts",
      "  +L2: don't hardcode secrets",
      "  | const token = 'secret';",
      "notes: token handling is wrong",
      "",
    ].join("\n"),
  );
  expect(prompt).not.toContain("src/other.ts");
  expect(prompt).not.toContain("Toolbelt review");
  expect(wrapReviewPrompt(prompt)).toContain("<<<TOOLBELT_REVIEW");
});

test("renderReviewPrompt omits pending files on partial annotation", () => {
  const feedback = parseFeedback({
    notes: "",
    files: [
      { path: "src/ok.ts", verdict: "pending" },
      { path: "src/bad.ts", verdict: "unapproved" },
      { path: "src/other.ts", verdict: "pending" },
    ],
    comments: [],
    edits: [],
  });
  expect(feedback.isOk()).toBe(true);
  if (feedback.isErr()) return;
  const prompt = renderReviewPrompt(snapshot, feedback.value);
  expect(prompt).toBe("fix: src/bad.ts\n");
  expect(prompt).not.toContain("src/ok.ts");
  expect(prompt).not.toContain("/tmp/demo");
});
