export type MergeKind = "stable" | "ours" | "theirs" | "same" | "conflict";

export type MergeRegion =
  | { id: string; kind: "stable"; lines: string[] }
  | { id: string; kind: "same"; lines: string[] }
  | { id: string; kind: "ours"; base: string[]; ours: string[] }
  | { id: string; kind: "theirs"; base: string[]; theirs: string[] }
  | { id: string; kind: "conflict"; base: string[]; ours: string[]; theirs: string[] };

export type PickSide = "ours" | "theirs" | "base" | "both";

export type RowTag = "ctx" | "ours" | "theirs" | "conflict" | "empty" | "result";

export type AlignCell = { n: number | null; text: string | null; tag: RowTag };

export type AlignRow = {
  regionId: string;
  first: boolean;
  pickable: boolean;
  conflict: boolean;
  left: AlignCell;
  result: AlignCell;
  right: AlignCell;
};

export type LineHunk = { a0: number; a1: number; b0: number; b1: number };

export function splitLines(text: string): { lines: string[]; eofNewline: boolean } {
  if (text === "") return { lines: [], eofNewline: false };
  const eofNewline = text.endsWith("\n");
  const body = eofNewline ? text.slice(0, -1) : text;
  return { lines: body.length ? body.split("\n") : [""], eofNewline };
}

export function joinLines(lines: string[], eofNewline: boolean): string {
  if (lines.length === 0) return eofNewline ? "\n" : "";
  return lines.join("\n") + (eofNewline ? "\n" : "");
}

const linesEq = (a: string[], b: string[]) =>
  a.length === b.length && a.every((l, i) => l === b[i]);

/** Myers shortest-edit script as equal/delete/insert ops over line arrays. */
export function diffOps(a: string[], b: string[]): Array<"eq" | "del" | "ins"> {
  const n = a.length;
  const m = b.length;
  if (n === 0) return Array.from({ length: m }, () => "ins" as const);
  if (m === 0) return Array.from({ length: n }, () => "del" as const);

  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 1);
  const trace: Int32Array[] = [];

  let dFound = -1;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(Int32Array.from(v));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + offset]! < v[k + 1 + offset]!)) {
        x = v[k + 1 + offset]!;
      } else {
        x = v[k - 1 + offset]! + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[k + offset] = x;
      if (x >= n && y >= m) {
        dFound = d;
        break outer;
      }
    }
  }

  if (dFound < 0) {
    return [
      ...Array.from({ length: n }, () => "del" as const),
      ...Array.from({ length: m }, () => "ins" as const),
    ];
  }

  const ops: Array<"eq" | "del" | "ins"> = [];
  let x = n;
  let y = m;
  for (let d = dFound; d > 0; d--) {
    const vPrev = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && vPrev[k - 1 + offset]! < vPrev[k + 1 + offset]!)) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vPrev[prevK + offset]!;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push("eq");
      x -= 1;
      y -= 1;
    }
    if (x === prevX) {
      ops.push("ins");
      y = prevY;
    } else {
      ops.push("del");
      x = prevX;
    }
    y = prevY;
    x = prevX;
  }
  while (x > 0 && y > 0) {
    ops.push("eq");
    x -= 1;
    y -= 1;
  }
  while (x > 0) {
    ops.push("del");
    x -= 1;
  }
  while (y > 0) {
    ops.push("ins");
    y -= 1;
  }
  return ops.reverse();
}

export function lineHunks(a: string[], b: string[]): LineHunk[] {
  const ops = diffOps(a, b);
  const hunks: LineHunk[] = [];
  let ai = 0;
  let bi = 0;
  let i = 0;
  while (i < ops.length) {
    if (ops[i] === "eq") {
      ai += 1;
      bi += 1;
      i += 1;
      continue;
    }
    const h: LineHunk = { a0: ai, a1: ai, b0: bi, b1: bi };
    while (i < ops.length && ops[i] !== "eq") {
      if (ops[i] === "del") {
        h.a1 += 1;
        ai += 1;
      } else {
        h.b1 += 1;
        bi += 1;
      }
      i += 1;
    }
    hunks.push(h);
  }
  return hunks;
}

const overlap = (x: LineHunk, y: LineHunk) =>
  (x.a0 === x.a1 && y.a0 === y.a1 && x.a0 === y.a0) || (x.a0 < y.a1 && y.a0 < x.a1);

function sideIndexAtBase(hunks: LineHunk[], baseIdx: number, atEnd: boolean): number {
  let a = 0;
  let b = 0;
  for (const h of hunks) {
    if (baseIdx < h.a0 || (baseIdx === h.a0 && !atEnd && h.a0 < h.a1)) {
      return h.b0 - (h.a0 - baseIdx);
    }
    if (
      baseIdx < h.a1 ||
      (baseIdx === h.a0 && h.a0 === h.a1 && !atEnd) ||
      (atEnd && baseIdx === h.a1 && h.a0 === h.a1)
    ) {
      return atEnd ? h.b1 : h.b0;
    }
    a = h.a1;
    b = h.b1;
  }
  return b + (baseIdx - a);
}

function sliceSide(hunks: LineHunk[], side: string[], a0: number, a1: number): string[] {
  const from = sideIndexAtBase(hunks, a0, false);
  const to = sideIndexAtBase(hunks, a1, true);
  return side.slice(Math.max(0, from), Math.max(from, to));
}

export function mergeFiles(baseText: string, oursText: string, theirsText: string): MergeRegion[] {
  const base = splitLines(baseText).lines;
  const ours = splitLines(oursText).lines;
  const theirs = splitLines(theirsText).lines;
  const oh = lineHunks(base, ours);
  const th = lineHunks(base, theirs);
  const regions: MergeRegion[] = [];
  let bi = 0;
  let oi = 0;
  let ti = 0;
  let n = 0;
  const id = () => `r${n++}`;

  const pushStable = (from: number, to: number) => {
    if (to > from) regions.push({ id: id(), kind: "stable", lines: base.slice(from, to) });
  };

  while (oi < oh.length || ti < th.length) {
    const o = oh[oi];
    const t = th[ti];
    if (o && t && overlap(o, t)) {
      let a0 = Math.min(o.a0, t.a0);
      let a1 = Math.max(o.a1, t.a1);
      let oLast = oi;
      let tLast = ti;
      let changed = true;
      while (changed) {
        changed = false;
        while (oLast + 1 < oh.length && overlap({ a0, a1, b0: 0, b1: 0 }, oh[oLast + 1]!)) {
          oLast += 1;
          a0 = Math.min(a0, oh[oLast]!.a0);
          a1 = Math.max(a1, oh[oLast]!.a1);
          changed = true;
        }
        while (tLast + 1 < th.length && overlap({ a0, a1, b0: 0, b1: 0 }, th[tLast + 1]!)) {
          tLast += 1;
          a0 = Math.min(a0, th[tLast]!.a0);
          a1 = Math.max(a1, th[tLast]!.a1);
          changed = true;
        }
      }
      pushStable(bi, a0);
      const oursLines = sliceSide(oh, ours, a0, a1);
      const theirsLines = sliceSide(th, theirs, a0, a1);
      if (linesEq(oursLines, theirsLines)) {
        regions.push({ id: id(), kind: "same", lines: oursLines });
      } else {
        regions.push({
          id: id(),
          kind: "conflict",
          base: base.slice(a0, a1),
          ours: oursLines,
          theirs: theirsLines,
        });
      }
      bi = a1;
      oi = oLast + 1;
      ti = tLast + 1;
      continue;
    }
    if (o && (!t || o.a0 <= t.a0)) {
      pushStable(bi, o.a0);
      regions.push({
        id: id(),
        kind: "ours",
        base: base.slice(o.a0, o.a1),
        ours: ours.slice(o.b0, o.b1),
      });
      bi = o.a1;
      oi += 1;
      continue;
    }
    if (t) {
      pushStable(bi, t.a0);
      regions.push({
        id: id(),
        kind: "theirs",
        base: base.slice(t.a0, t.a1),
        theirs: theirs.slice(t.b0, t.b1),
      });
      bi = t.a1;
      ti += 1;
    }
  }
  pushStable(bi, base.length);
  return regions;
}

export function regionOurs(r: MergeRegion): string[] {
  if (r.kind === "stable" || r.kind === "same") return r.lines;
  if (r.kind === "theirs") return r.base;
  return r.ours;
}

export function regionTheirs(r: MergeRegion): string[] {
  if (r.kind === "stable" || r.kind === "same") return r.lines;
  if (r.kind === "ours") return r.base;
  return r.theirs;
}

export function resultLines(
  r: MergeRegion,
  pick: PickSide | undefined,
  manual: string[] | undefined,
  autoNonConflict: boolean,
): { lines: string[]; unresolved: boolean } {
  if (manual) return { lines: manual, unresolved: false };
  if (r.kind === "stable" || r.kind === "same") return { lines: r.lines, unresolved: false };
  if (r.kind === "ours") {
    if (pick === "base") return { lines: r.base, unresolved: false };
    if (pick === "theirs") return { lines: r.base, unresolved: false };
    if (pick === "both") return { lines: [...r.ours, ...r.base], unresolved: false };
    if (pick === "ours" || autoNonConflict) return { lines: r.ours, unresolved: false };
    return { lines: r.base, unresolved: false };
  }
  if (r.kind === "theirs") {
    if (pick === "base") return { lines: r.base, unresolved: false };
    if (pick === "ours") return { lines: r.base, unresolved: false };
    if (pick === "both") return { lines: [...r.base, ...r.theirs], unresolved: false };
    if (pick === "theirs" || autoNonConflict) return { lines: r.theirs, unresolved: false };
    return { lines: r.base, unresolved: false };
  }
  if (pick === "ours") return { lines: r.ours, unresolved: false };
  if (pick === "theirs") return { lines: r.theirs, unresolved: false };
  if (pick === "base") return { lines: r.base, unresolved: false };
  if (pick === "both") return { lines: [...r.ours, ...r.theirs], unresolved: false };
  return { lines: [], unresolved: true };
}

export function materialize(
  regions: MergeRegion[],
  picks: Record<string, PickSide>,
  manual: Record<string, string[]>,
  autoNonConflict: boolean,
  eofNewline: boolean,
): { text: string; unresolved: string[] } {
  const lines: string[] = [];
  const unresolved: string[] = [];
  for (const r of regions) {
    const got = resultLines(r, picks[r.id], manual[r.id], autoNonConflict);
    if (got.unresolved) unresolved.push(r.id);
    lines.push(...got.lines);
  }
  return { text: joinLines(lines, eofNewline), unresolved };
}

export function conflictCount(regions: MergeRegion[]): number {
  return regions.filter((r) => r.kind === "conflict").length;
}

export function pendingChangeCount(
  regions: MergeRegion[],
  picks: Record<string, PickSide>,
  autoNonConflict: boolean,
): number {
  let n = 0;
  for (const r of regions) {
    if (r.kind === "ours" || r.kind === "theirs") {
      if (!autoNonConflict && picks[r.id] == null) n += 1;
    }
  }
  return n;
}

export function alignRows(
  regions: MergeRegion[],
  picks: Record<string, PickSide>,
  manual: Record<string, string[]>,
  autoNonConflict: boolean,
): AlignRow[] {
  const rows: AlignRow[] = [];
  let leftN = 1;
  let resultN = 1;
  let rightN = 1;

  for (const r of regions) {
    const leftLines = regionOurs(r);
    const rightLines = regionTheirs(r);
    const got = resultLines(r, picks[r.id], manual[r.id], autoNonConflict);
    const height = Math.max(leftLines.length, rightLines.length, got.lines.length, 1);
    const pickable = r.kind !== "stable" && r.kind !== "same";
    const conflict = r.kind === "conflict" && got.unresolved;
    const leftTag: RowTag =
      r.kind === "conflict"
        ? "conflict"
        : r.kind === "ours"
          ? "ours"
          : r.kind === "same"
            ? "ours"
            : "ctx";
    const rightTag: RowTag =
      r.kind === "conflict"
        ? "conflict"
        : r.kind === "theirs"
          ? "theirs"
          : r.kind === "same"
            ? "theirs"
            : "ctx";
    const resultTag: RowTag = got.unresolved ? "conflict" : pickable ? "result" : "ctx";

    for (let i = 0; i < height; i++) {
      const leftText = i < leftLines.length ? leftLines[i]! : null;
      const rightText = i < rightLines.length ? rightLines[i]! : null;
      const resultText = i < got.lines.length ? got.lines[i]! : null;
      rows.push({
        regionId: r.id,
        first: i === 0,
        pickable,
        conflict,
        left: {
          n: leftText == null ? null : leftN++,
          text: leftText,
          tag: leftText == null ? "empty" : leftTag,
        },
        result: {
          n: resultText == null ? null : resultN++,
          text: resultText,
          tag: resultText == null ? "empty" : resultTag,
        },
        right: {
          n: rightText == null ? null : rightN++,
          text: rightText,
          tag: rightText == null ? "empty" : rightTag,
        },
      });
    }
  }
  return rows;
}
