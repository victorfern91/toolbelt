import { err, ok, type Result } from "neverthrow";
import type {
  AnnotationSide,
  ReviewComment,
  ReviewEdit,
  ReviewFeedback,
  ReviewFile,
  ReviewSnapshot,
  Verdict,
} from "./types.ts";

export const REVIEW_PROMPT_START = "<<<TOOLBELT_REVIEW";
export const REVIEW_PROMPT_END = "TOOLBELT_REVIEW>>>";

const VERDICTS = new Set<Verdict>(["approved", "unapproved", "pending"]);
const SIDES = new Set<AnnotationSide>(["additions", "deletions"]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asString = (v: unknown) => (typeof v === "string" ? v : null);
const asInt = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);

const excerpt = (contents: string | null, start: number, end: number): string => {
  if (!contents) return "";
  const lines = contents.split("\n");
  const from = Math.max(1, start);
  const to = Math.max(from, end);
  return lines
    .slice(from - 1, to)
    .map((line, i) => `${String(from + i).padStart(4)}| ${line}`)
    .join("\n");
};

const contentsFor = (file: ReviewFile | undefined, side: AnnotationSide) =>
  side === "deletions" ? (file?.oldContents ?? null) : (file?.newContents ?? null);

export const parseFeedback = (body: unknown): Result<ReviewFeedback, string> => {
  if (!isRecord(body)) return err("feedback must be an object");
  const notes = asString(body.notes) ?? "";
  const filesRaw = Array.isArray(body.files) ? body.files : [];
  const commentsRaw = Array.isArray(body.comments) ? body.comments : [];
  const editsRaw = Array.isArray(body.edits) ? body.edits : [];

  const files: ReviewFeedback["files"] = [];
  for (const row of filesRaw) {
    if (!isRecord(row)) return err("file verdict must be an object");
    const path = asString(row.path);
    const verdict = asString(row.verdict);
    if (!path) return err("file verdict needs a path");
    if (!verdict || !VERDICTS.has(verdict as Verdict)) return err(`bad verdict for ${path}`);
    files.push({ path, verdict: verdict as Verdict });
  }

  const comments: ReviewComment[] = [];
  for (const row of commentsRaw) {
    if (!isRecord(row)) return err("comment must be an object");
    const path = asString(row.path);
    const side = asString(row.side);
    const bodyText = asString(row.body)?.trim() ?? "";
    const startLine = asInt(row.startLine);
    const endLine = asInt(row.endLine) ?? startLine;
    const id = asString(row.id) ?? `${path}:${startLine}`;
    if (
      !path ||
      !side ||
      !SIDES.has(side as AnnotationSide) ||
      startLine == null ||
      startLine < 0
    ) {
      return err("comment needs path, side, and startLine");
    }
    if (!bodyText) continue;
    comments.push({
      id,
      path,
      side: side as AnnotationSide,
      startLine,
      endLine: endLine == null ? startLine : Math.max(startLine, endLine),
      body: bodyText,
    });
  }

  const edits: ReviewEdit[] = [];
  for (const row of editsRaw) {
    if (!isRecord(row)) return err("edit must be an object");
    const path = asString(row.path);
    const contents = asString(row.contents);
    if (!path || contents == null) return err("edit needs path and contents");
    edits.push({ path, contents });
  }

  return ok({ notes, files, comments, edits });
};

const byPath = (files: ReviewFile[]) => new Map(files.map((f) => [f.path, f]));

export const renderReviewPrompt = (snapshot: ReviewSnapshot, feedback: ReviewFeedback): string => {
  const files = byPath(snapshot.files);
  const verdictOf = (path: string): Verdict =>
    feedback.files.find((f) => f.path === path)?.verdict ?? "pending";

  const unapproved = snapshot.files.filter((f) => verdictOf(f.path) === "unapproved");
  const approved = snapshot.files.filter((f) => verdictOf(f.path) === "approved");
  const pending = snapshot.files.filter((f) => verdictOf(f.path) === "pending");
  const comments = feedback.comments;
  const edits = feedback.edits.filter(
    (e) => files.has(e.path) || snapshot.files.some((f) => f.path === e.path),
  );
  const notes = feedback.notes.trim();

  const lines: string[] = [
    "# Toolbelt review feedback",
    "",
    "Apply this review to the working tree. Address every unapproved file and every comment.",
    "Keep approved files as they are. If a file was edited in the review UI, treat that content as the requested result.",
    "Do not skip locations.",
    "",
    `Repo: ${snapshot.root}`,
    `Branch: ${snapshot.branch} (vs ${snapshot.base})`,
    `Files: ${snapshot.files.length}`,
    "",
  ];

  const dumpComments = (path: string) => {
    const mine = comments.filter((c) => c.path === path);
    if (!mine.length) return;
    lines.push("Comments:");
    for (const c of mine) {
      const range = c.startLine === c.endLine ? `L${c.startLine}` : `L${c.startLine}–${c.endLine}`;
      lines.push(`- ${c.side} ${range}:`);
      lines.push(`  > ${c.body.replace(/\n/g, "\n  > ")}`);
      const snippet = excerpt(contentsFor(files.get(path), c.side), c.startLine, c.endLine);
      if (snippet) {
        lines.push("  ```");
        for (const row of snippet.split("\n")) lines.push(`  ${row}`);
        lines.push("  ```");
      }
    }
    lines.push("");
  };

  if (unapproved.length) {
    lines.push("## Unapproved (must address)", "");
    for (const f of unapproved) {
      lines.push(`### \`${f.path}\` (${f.status})`);
      lines.push("The reviewer rejected this change. Revise or revert it.");
      if (f.skipped) lines.push(`Skipped in the UI (${f.skipped}).`);
      lines.push("");
      dumpComments(f.path);
    }
  }

  const orphanComments = comments.filter((c) => verdictOf(c.path) !== "unapproved");
  if (orphanComments.length) {
    lines.push("## Comments", "");
    const grouped = new Map<string, ReviewComment[]>();
    for (const c of orphanComments) {
      const list = grouped.get(c.path) ?? [];
      list.push(c);
      grouped.set(c.path, list);
    }
    for (const [path, list] of grouped) {
      const file = files.get(path);
      lines.push(`### \`${path}\`${file ? ` (${file.status})` : ""}`);
      lines.push("");
      for (const c of list) {
        const range =
          c.startLine === c.endLine ? `L${c.startLine}` : `L${c.startLine}–${c.endLine}`;
        lines.push(`- ${c.side} ${range}:`);
        lines.push(`  > ${c.body.replace(/\n/g, "\n  > ")}`);
        const snippet = excerpt(contentsFor(file, c.side), c.startLine, c.endLine);
        if (snippet) {
          lines.push("  ```");
          for (const row of snippet.split("\n")) lines.push(`  ${row}`);
          lines.push("  ```");
        }
      }
      lines.push("");
    }
  }

  if (edits.length) {
    lines.push("## Requested edits", "");
    lines.push("Replace these files with the reviewer's edited contents.", "");
    for (const e of edits) {
      lines.push(`### \`${e.path}\``);
      lines.push("");
      lines.push("```");
      lines.push(e.contents.endsWith("\n") ? e.contents.slice(0, -1) : e.contents);
      lines.push("```");
      lines.push("");
    }
  }

  if (approved.length) {
    lines.push("## Approved (keep)", "");
    for (const f of approved) lines.push(`- \`${f.path}\` (${f.status})`);
    lines.push("");
  }

  if (pending.length) {
    lines.push("## No verdict", "");
    lines.push(
      "The reviewer left these pending — use comments if present, otherwise leave them unless they conflict with the feedback above.",
    );
    for (const f of pending) lines.push(`- \`${f.path}\` (${f.status})`);
    lines.push("");
  }

  if (notes) {
    lines.push("## Notes", "", notes, "");
  }

  if (!unapproved.length && !comments.length && !edits.length && !notes) {
    lines.push(
      "No comments, edits, or unapprovals. Treat the current diff as accepted unless a later message says otherwise.",
      "",
    );
  }

  return lines.join("\n").trim() + "\n";
};

export const wrapReviewPrompt = (body: string) =>
  `${REVIEW_PROMPT_START}\n${body.trim()}\n${REVIEW_PROMPT_END}`;
