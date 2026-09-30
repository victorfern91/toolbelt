import { expect, test } from "bun:test";
import {
  alignRows,
  conflictCount,
  diffOps,
  joinLines,
  lineHunks,
  materialize,
  mergeFiles,
  pendingChangeCount,
  splitLines,
  toggleRegionSide,
} from "./merge.ts";

test("split/join round-trip preserves eof newline", () => {
  for (const s of ["", "a", "a\n", "a\nb", "a\nb\n", "\n"]) {
    const { lines, eofNewline } = splitLines(s);
    expect(joinLines(lines, eofNewline)).toBe(s);
  }
});

test("diff identical is all eq", () => {
  expect(diffOps(["a", "b"], ["a", "b"])).toEqual(["eq", "eq"]);
});

test("diff insert and delete", () => {
  expect(diffOps(["a", "b"], ["a", "x", "b"])).toEqual(["eq", "ins", "eq"]);
  expect(diffOps(["a", "x", "b"], ["a", "b"])).toEqual(["eq", "del", "eq"]);
});

test("diff replace", () => {
  expect(lineHunks(["a", "b", "c"], ["a", "x", "c"])).toEqual([{ a0: 1, a1: 2, b0: 1, b1: 2 }]);
});

test("ours-only change is auto-merged", () => {
  const regions = mergeFiles("a\nb\nc\n", "a\nX\nc\n", "a\nb\nc\n");
  expect(regions.map((r) => r.kind)).toEqual(["stable", "ours", "stable"]);
  const { text, unresolved } = materialize(regions, {}, {}, true, true);
  expect(unresolved).toEqual([]);
  expect(text).toBe("a\nX\nc\n");
});

test("theirs-only change is auto-merged", () => {
  const regions = mergeFiles("a\nb\nc\n", "a\nb\nc\n", "a\nY\nc\n");
  expect(regions.map((r) => r.kind)).toEqual(["stable", "theirs", "stable"]);
  const { text } = materialize(regions, {}, {}, true, true);
  expect(text).toBe("a\nY\nc\n");
});

test("both sides same change is not a conflict", () => {
  const regions = mergeFiles("a\nb\nc\n", "a\nZ\nc\n", "a\nZ\nc\n");
  expect(regions.map((r) => r.kind)).toEqual(["stable", "same", "stable"]);
  const { text, unresolved } = materialize(regions, {}, {}, true, true);
  expect(unresolved).toEqual([]);
  expect(text).toBe("a\nZ\nc\n");
});

test("divergent edits of the same line are a conflict", () => {
  const regions = mergeFiles("a\nb\nc\n", "a\nX\nc\n", "a\nY\nc\n");
  expect(regions.map((r) => r.kind)).toEqual(["stable", "conflict", "stable"]);
  const conflict = regions.find((r) => r.kind === "conflict");
  expect(conflict?.kind === "conflict" && conflict.ours).toEqual(["X"]);
  expect(conflict?.kind === "conflict" && conflict.theirs).toEqual(["Y"]);
  const unresolved = materialize(regions, {}, {}, true, true);
  expect(unresolved.unresolved).toHaveLength(1);
  expect(unresolved.text).toBe("a\nc\n");
  const ours = materialize(regions, { [conflict!.id]: "ours" }, {}, true, true);
  expect(ours.text).toBe("a\nX\nc\n");
  const theirs = materialize(regions, { [conflict!.id]: "theirs" }, {}, true, true);
  expect(theirs.text).toBe("a\nY\nc\n");
  const both = materialize(regions, { [conflict!.id]: "both" }, {}, true, true);
  expect(both.text).toBe("a\nX\nY\nc\n");
  expect(toggleRegionSide(conflict!, undefined, "ours", true)).toBe("ours");
  expect(toggleRegionSide(conflict!, "ours", "theirs", true)).toBe("both");
  expect(toggleRegionSide(conflict!, "both", "ours", true)).toBe("theirs");
});

test("inserts at the same position conflict", () => {
  const regions = mergeFiles("a\nc\n", "a\nL\nc\n", "a\nR\nc\n");
  expect(regions.some((r) => r.kind === "conflict")).toBe(true);
});

test("non-overlapping edits auto-merge", () => {
  const regions = mergeFiles("a\nb\nc\nd\n", "a\nL\nc\nd\n", "a\nb\nc\nR\n");
  expect(regions.some((r) => r.kind === "conflict")).toBe(false);
  const { text } = materialize(regions, {}, {}, true, true);
  expect(text).toBe("a\nL\nc\nR\n");
});

test("auto-off leaves one-sided changes as base until picked", () => {
  const regions = mergeFiles("a\nb\n", "a\nX\n", "a\nb\n");
  const auto = materialize(regions, {}, {}, true, true);
  expect(auto.text).toBe("a\nX\n");
  const off = materialize(regions, {}, {}, false, true);
  expect(off.text).toBe("a\nb\n");
});

test("manual lines win over pick", () => {
  const regions = mergeFiles("a\nb\n", "a\nX\n", "a\nY\n");
  const conflict = regions.find((r) => r.kind === "conflict")!;
  const { text, unresolved } = materialize(
    regions,
    { [conflict.id]: "ours" },
    { [conflict.id]: ["Z"] },
    true,
    true,
  );
  expect(unresolved).toEqual([]);
  expect(text).toBe("a\nZ\n");
});

test("Book.java-style record field conflict", () => {
  const base = [
    "public record Book(String title,",
    "  List<String> authors,",
    "  String publisher,",
    "  LocalDate publicationDate,",
    "  String isbn,",
    "  int pages) {",
    "",
    "  public boolean containsAuthor(String author) {",
    "    return authors.contains(author);",
    "  }",
    "}",
    "",
  ].join("\n");
  const ours = base.replace("  int pages) {", "  int pages,\n  boolean illustrated) {");
  const theirs = base.replace("  int pages) {", "  int pages,\n  int weight) {");
  const regions = mergeFiles(base, ours, theirs);
  expect(conflictCount(regions)).toBe(1);
  const conflict = regions.find((r) => r.kind === "conflict")!;
  expect(conflict.kind === "conflict" && conflict.ours.join("\n")).toContain("illustrated");
  expect(conflict.kind === "conflict" && conflict.theirs.join("\n")).toContain("weight");
  const { text } = materialize(regions, { [conflict.id]: "ours" }, {}, true, true);
  expect(text).toContain("illustrated");
  expect(text).not.toContain("weight");
});

test("alignRows pads shorter sides and numbers real lines", () => {
  const regions = mergeFiles("a\nb\n", "a\nX\nY\n", "a\nZ\n");
  const rows = alignRows(regions, {}, {}, true);
  expect(rows[0]?.left.text).toBe("a");
  expect(rows[0]?.left.n).toBe(1);
  const body = rows.filter((r) => r.regionId !== rows[0]!.regionId);
  expect(body.some((r) => r.left.text === "X")).toBe(true);
  expect(body.some((r) => r.right.text === "Z")).toBe(true);
  expect(body.some((r) => r.left.text == null || r.right.text == null)).toBe(true);
});

test("pendingChangeCount is 0 when auto-applying non-conflicts", () => {
  const regions = mergeFiles("a\nb\n", "a\nX\n", "a\nb\n");
  expect(pendingChangeCount(regions, {}, true)).toBe(0);
  expect(pendingChangeCount(regions, {}, false)).toBe(1);
});
