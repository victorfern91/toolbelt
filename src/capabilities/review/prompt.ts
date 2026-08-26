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

/** True when the reviewer left any verdict, comment, edit, or notes. */
export const hasActionableFeedback = (feedback: ReviewFeedback): boolean =>
  Boolean(
    feedback.notes.trim() ||
      feedback.comments.length ||
      feedback.edits.length ||
      feedback.files.some((f) => f.verdict !== "pending"),
  );

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

const sideMark = (side: AnnotationSide) => (side === "deletions" ? "-" : "+");

const rangeMark = (start: number, end: number) =>
  start === end ? `L${start}` : `L${start}-${end}`;

/** One comment as compact lines: `  +L2: body` then optional `  | snippet`. */
const commentLines = (
  c: ReviewComment,
  contents: string | null,
): string[] => {
  const out = [`  ${sideMark(c.side)}${rangeMark(c.startLine, c.endLine)}: ${c.body}`];
  const snippet = excerpt(contents, c.startLine, c.endLine);
  if (snippet) {
    for (const row of snippet.split("\n")) {
      // strip the "   N| " prefix from excerpt — path+range already locate it
      const pipe = row.indexOf("| ");
      out.push(`  | ${pipe >= 0 ? row.slice(pipe + 2) : row.trimStart()}`);
    }
  }
  return out;
};

/**
 * Dense review payload (RTK-style). Instructions live in the skill — this is data only.
 * Pending/unlisted files omitted.
 */
export const renderReviewPrompt = (snapshot: ReviewSnapshot, feedback: ReviewFeedback): string => {
  const files = byPath(snapshot.files);
  const verdictOf = (path: string): Verdict =>
    feedback.files.find((f) => f.path === path)?.verdict ?? "pending";

  const unapproved = snapshot.files.filter((f) => verdictOf(f.path) === "unapproved");
  const approved = snapshot.files.filter((f) => verdictOf(f.path) === "approved");
  const comments = feedback.comments;
  const edits = feedback.edits.filter(
    (e) => files.has(e.path) || snapshot.files.some((f) => f.path === e.path),
  );
  const notes = feedback.notes.trim();
  const lines: string[] = [];

  if (approved.length) {
    lines.push(`ok: ${approved.map((f) => f.path).join(" ")}`);
  }

  for (const f of unapproved) {
    lines.push(`fix: ${f.path}${f.skipped ? ` !${f.skipped}` : ""}`);
    for (const c of comments.filter((x) => x.path === f.path)) {
      lines.push(...commentLines(c, contentsFor(f, c.side)));
    }
  }

  const orphanComments = comments.filter((c) => verdictOf(c.path) !== "unapproved");
  if (orphanComments.length) {
    const grouped = new Map<string, ReviewComment[]>();
    for (const c of orphanComments) {
      const list = grouped.get(c.path) ?? [];
      list.push(c);
      grouped.set(c.path, list);
    }
    for (const [path, list] of grouped) {
      lines.push(`note: ${path}`);
      const file = files.get(path);
      for (const c of list) {
        lines.push(...commentLines(c, contentsFor(file, c.side)));
      }
    }
  }

  for (const e of edits) {
    lines.push(`edit: ${e.path}`);
    lines.push("<<<");
    lines.push(e.contents.endsWith("\n") ? e.contents.slice(0, -1) : e.contents);
    lines.push(">>>");
  }

  if (notes) lines.push(`notes: ${notes.replace(/\n/g, "\\n")}`);

  return lines.join("\n").trim() + "\n";
};

export const wrapReviewPrompt = (body: string) =>
  `${REVIEW_PROMPT_START}\n${body.trim()}\n${REVIEW_PROMPT_END}`;
