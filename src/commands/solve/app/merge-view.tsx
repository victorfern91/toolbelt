import { useCallback, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { parseDiffFromFile, type FileContents } from "@pierre/diffs";
import { File, FileDiff } from "@pierre/diffs/react";
import type { EditorOptions } from "@pierre/diffs/edit";
import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../../web/tokens.stylex.ts";
import { Button } from "../../../web/chrome.tsx";
import { pierreDiffOptions, pierreFileOptions } from "../../../web/pierre.ts";
import {
  activeFileAtom,
  activeStateAtom,
  autoNonConflictAtom,
  editResultAtom,
  highlightWordsAtom,
  materializedAtom,
  pickRegionAtom,
  regionsAtom,
  rejectRegionAtom,
  resolvedAtom,
  snapshotAtom,
  toggleSideAtom,
} from "./store.ts";
import {
  pickableRegionAtLine,
  sideIncluded,
  type MergeRegion,
  type PickSide,
} from "../../../capabilities/solve/merge.ts";

const styles = stylex.create({
  merge: {
    height: "100%",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 44px minmax(0, 1fr) 44px minmax(0, 1fr)",
    gridTemplateRows: "auto minmax(0, 1fr)",
  },
  head: {
    paddingBlock: "0.4rem",
    paddingInline: "0.7rem",
    fontSize: 12,
    color: tokens.muted,
    backgroundColor: tokens.bg2,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.border,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  railHead: {
    backgroundColor: tokens.bg2,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.border,
  },
  pane: {
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    position: "relative",
    cursor: "pointer",
  },
  resultPane: {
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    position: "relative",
    cursor: "text",
  },
  rail: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
    backgroundColor: tokens.bg2,
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: tokens.border,
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: tokens.border,
  },
  group: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
});

function preview(region: MergeRegion): string {
  if (region.kind === "ours") return region.ours[0] ?? "(delete)";
  if (region.kind === "theirs") return region.theirs[0] ?? "(delete)";
  if (region.kind === "conflict") return region.ours[0] ?? region.theirs[0] ?? "conflict";
  return "";
}

function Rail({
  regions,
  side,
  picks,
  auto,
}: {
  regions: MergeRegion[];
  side: "left" | "right";
  picks: Record<string, PickSide>;
  auto: boolean;
}) {
  const toggle = useSetAtom(toggleSideAtom);
  const reject = useSetAtom(rejectRegionAtom);
  const pick = useSetAtom(pickRegionAtom);
  const take: "ours" | "theirs" = side === "left" ? "ours" : "theirs";
  const chev = side === "left" ? "»" : "«";
  const kinds = side === "left" ? new Set(["conflict", "ours"]) : new Set(["conflict", "theirs"]);
  return (
    <div {...stylex.props(styles.rail)}>
      {regions
        .filter((r) => kinds.has(r.kind))
        .map((r) => (
          <div key={r.id} {...stylex.props(styles.group)} title={preview(r)}>
            <Button
              type="button"
              chev="reject"
              title={side === "left" ? "Drop ours" : "Drop theirs"}
              onClick={() => reject({ regionId: r.id, side: take })}
            >
              ×
            </Button>
            <Button
              type="button"
              chev="take"
              active={sideIncluded(r, picks[r.id], auto, take)}
              title={side === "left" ? "Toggle ours into result" : "Toggle theirs into result"}
              onClick={() => toggle({ regionId: r.id, side: take })}
            >
              {chev}
            </Button>
            {r.kind === "conflict" ? (
              <Button
                type="button"
                chev="both"
                active={picks[r.id] === "both"}
                title="Keep both sides"
                onClick={() => pick({ regionId: r.id, pick: "both" })}
              >
                «»
              </Button>
            ) : null}
          </div>
        ))}
    </div>
  );
}

export function MergeView() {
  const snapshot = useAtomValue(snapshotAtom);
  const file = useAtomValue(activeFileAtom);
  const regions = useAtomValue(regionsAtom);
  const state = useAtomValue(activeStateAtom);
  const auto = useAtomValue(autoNonConflictAtom);
  const highlight = useAtomValue(highlightWordsAtom);
  const resolved = useAtomValue(resolvedAtom);
  const materialized = useAtomValue(materializedAtom);
  const toggle = useSetAtom(toggleSideAtom);
  const setOverride = useSetAtom(editResultAtom);
  const path = file?.path ?? "file";
  const seed = materialized.text;
  const editorOptions = useMemo<EditorOptions<undefined>>(
    () => ({
      persistState: true,
      onChange: (next: FileContents) => {
        if (next.contents === seed) return;
        setOverride(next.contents);
      },
    }),
    [seed, setOverride],
  );
  const pickSig = Object.entries(state.picks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, pick]) => `${id}:${pick}`)
    .join(",");
  const onOursLine = useCallback(
    ({ lineNumber, side }: { lineNumber: number; side: "deletions" | "additions" }) => {
      const r = pickableRegionAtLine(regions, side === "additions" ? "ours" : "base", lineNumber);
      if (r) toggle({ regionId: r.id, side: "ours" });
    },
    [regions, toggle],
  );
  const onTheirsLine = useCallback(
    ({ lineNumber, side }: { lineNumber: number; side: "deletions" | "additions" }) => {
      const r = pickableRegionAtLine(regions, side === "additions" ? "theirs" : "base", lineNumber);
      if (r) toggle({ regionId: r.id, side: "theirs" });
    },
    [regions, toggle],
  );
  const oursOpts = useMemo(
    () => pierreDiffOptions(highlight ? "word" : "none", { onLineClick: onOursLine }),
    [highlight, onOursLine],
  );
  const theirsOpts = useMemo(
    () => pierreDiffOptions(highlight ? "word" : "none", { onLineClick: onTheirsLine }),
    [highlight, onTheirsLine],
  );
  const oursDiff = useMemo(
    () =>
      parseDiffFromFile(
        { name: path, contents: file?.base ?? "", cacheKey: `${path}:base` },
        { name: path, contents: file?.ours ?? "", cacheKey: `${path}:ours` },
      ),
    [file?.base, file?.ours, path],
  );
  const theirsDiff = useMemo(
    () =>
      parseDiffFromFile(
        { name: path, contents: file?.base ?? "", cacheKey: `${path}:base` },
        { name: path, contents: file?.theirs ?? "", cacheKey: `${path}:theirs` },
      ),
    [file?.base, file?.theirs, path],
  );
  const resultFile = useMemo(
    () => ({
      name: path,
      contents: resolved.text,
      cacheKey: `${path}:result:${pickSig}:${auto}`,
    }),
    [auto, path, pickSig, resolved.text],
  );

  return (
    <div {...stylex.props(styles.merge)}>
      <div {...stylex.props(styles.head)}>Changes from {snapshot?.oursLabel ?? "ours"}</div>
      <div {...stylex.props(styles.railHead)} />
      <div {...stylex.props(styles.head)}>Result</div>
      <div {...stylex.props(styles.railHead)} />
      <div {...stylex.props(styles.head)}>Changes from {snapshot?.theirsLabel ?? "theirs"}</div>
      <div {...stylex.props(styles.pane)}>
        <FileDiff fileDiff={oursDiff} options={oursOpts} disableWorkerPool />
      </div>
      <Rail regions={regions} side="left" picks={state.picks} auto={auto} />
      <div {...stylex.props(styles.resultPane)}>
        <File
          file={resultFile}
          options={pierreFileOptions}
          edit
          editorOptions={editorOptions}
          disableWorkerPool
        />
      </div>
      <Rail regions={regions} side="right" picks={state.picks} auto={auto} />
      <div {...stylex.props(styles.pane)}>
        <FileDiff fileDiff={theirsDiff} options={theirsOpts} disableWorkerPool />
      </div>
    </div>
  );
}
