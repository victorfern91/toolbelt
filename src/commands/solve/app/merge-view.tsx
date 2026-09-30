import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { parseDiffFromFile } from "@pierre/diffs";
import { File, FileDiff } from "@pierre/diffs/react";
import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../../web/tokens.stylex.ts";
import { Button } from "../../../web/chrome.tsx";
import { pierreDiffOptions, pierreFileOptions } from "../../../web/pierre.ts";
import {
  activeFileAtom,
  activeStateAtom,
  autoNonConflictAtom,
  highlightWordsAtom,
  pickRegionAtom,
  regionsAtom,
  rejectRegionAtom,
  resolvedAtom,
  snapshotAtom,
} from "./store.ts";
import type { MergeRegion, PickSide } from "../../../capabilities/solve/merge.ts";

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

function Rail({ regions, side }: { regions: MergeRegion[]; side: "left" | "right" }) {
  const pick = useSetAtom(pickRegionAtom);
  const reject = useSetAtom(rejectRegionAtom);
  const take: PickSide = side === "left" ? "ours" : "theirs";
  const chev = side === "left" ? "»" : "«";
  return (
    <div {...stylex.props(styles.rail)}>
      {regions
        .filter((r) => r.kind === "conflict" || r.kind === "ours" || r.kind === "theirs")
        .map((r) => (
          <div key={r.id} {...stylex.props(styles.group)} title={preview(r)}>
            <Button
              type="button"
              chev="reject"
              title={side === "left" ? "Reject ours" : "Reject theirs"}
              onClick={() => reject(r.id)}
            >
              ×
            </Button>
            <Button
              type="button"
              chev="take"
              title={side === "left" ? "Accept ours" : "Accept theirs"}
              onClick={() => pick({ regionId: r.id, pick: take })}
            >
              {chev}
            </Button>
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
  const path = file?.path ?? "file";
  const diffOpts = useMemo(() => pierreDiffOptions(highlight ? "word" : "none"), [highlight]);
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
      cacheKey: `${path}:result:${resolved.text}:${state.picks ? Object.keys(state.picks).length : 0}:${auto}`,
    }),
    [auto, path, resolved.text, state.picks],
  );

  return (
    <div {...stylex.props(styles.merge)}>
      <div {...stylex.props(styles.head)}>Changes from {snapshot?.oursLabel ?? "ours"}</div>
      <div {...stylex.props(styles.railHead)} />
      <div {...stylex.props(styles.head)}>Result</div>
      <div {...stylex.props(styles.railHead)} />
      <div {...stylex.props(styles.head)}>Changes from {snapshot?.theirsLabel ?? "theirs"}</div>
      <div {...stylex.props(styles.pane)}>
        <FileDiff fileDiff={oursDiff} options={diffOpts} disableWorkerPool />
      </div>
      <Rail regions={regions} side="left" />
      <div {...stylex.props(styles.pane)}>
        <File file={resultFile} options={pierreFileOptions} disableWorkerPool />
      </div>
      <Rail regions={regions} side="right" />
      <div {...stylex.props(styles.pane)}>
        <FileDiff fileDiff={theirsDiff} options={diffOpts} disableWorkerPool />
      </div>
    </div>
  );
}
