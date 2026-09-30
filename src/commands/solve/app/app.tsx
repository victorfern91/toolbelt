import { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { MergeView } from "./merge-view.tsx";
import { ChangesTree } from "../../../web/changes-tree.tsx";
import { AppShell, Button, Msg, Row, Status, TitlePath, Toggle } from "../../../web/chrome.tsx";
import {
  snapshotAtom,
  errorAtom,
  activePathAtom,
  activeFileAtom,
  statsAtom,
  resolvedAtom,
  autoNonConflictAtom,
  highlightWordsAtom,
  busyAtom,
  doneAtom,
  loadSnapshotAtom,
  selectPathAtom,
  setAutoNonConflictAtom,
  setHighlightWordsAtom,
  acceptAllAtom,
  applyCurrentAtom,
  abandonAtom,
} from "./store.ts";

export function App() {
  const snapshot = useAtomValue(snapshotAtom);
  const error = useAtomValue(errorAtom);
  const file = useAtomValue(activeFileAtom);
  const activePath = useAtomValue(activePathAtom);
  const stats = useAtomValue(statsAtom);
  const resolved = useAtomValue(resolvedAtom);
  const auto = useAtomValue(autoNonConflictAtom);
  const highlight = useAtomValue(highlightWordsAtom);
  const busy = useAtomValue(busyAtom);
  const done = useAtomValue(doneAtom);
  const setAuto = useSetAtom(setAutoNonConflictAtom);
  const setHighlight = useSetAtom(setHighlightWordsAtom);
  const load = useSetAtom(loadSnapshotAtom);
  const select = useSetAtom(selectPathAtom);
  const acceptAll = useSetAtom(acceptAllAtom);
  const apply = useSetAtom(applyCurrentAtom);
  const abandon = useSetAtom(abandonAtom);
  const settledRef = useRef({ done: false });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    settledRef.current.done = done != null;
  }, [done]);

  useEffect(() => {
    const onHide = () => {
      if (settledRef.current.done) return;
      settledRef.current.done = true;
      navigator.sendBeacon("/api/abandon");
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  if (error) return <Msg>{error}</Msg>;
  if (!snapshot) return <Msg>Loading conflicts…</Msg>;
  if (done === "applied") {
    return (
      <Msg>Conflicts applied and staged. Continue the {snapshot.op} — you can close this tab.</Msg>
    );
  }
  if (done === "abandoned") {
    return <Msg>Left remaining conflicts in the worktree. You can close this tab.</Msg>;
  }
  if (!snapshot.files.length) return <Msg>No remaining conflicts.</Msg>;

  const changeBit =
    stats.changes === 0
      ? "No changes."
      : `${stats.changes} change${stats.changes === 1 ? "" : "s"}.`;
  const conflictBit =
    stats.remaining === 0
      ? "No conflicts."
      : `${stats.remaining} conflict${stats.remaining === 1 ? "" : "s"}.`;

  return (
    <AppShell
      kind="solve"
      badge="solve"
      title={
        <>
          Merge Revisions for <TitlePath>{file?.path ?? ""}</TitlePath>
        </>
      }
      meta={
        <>
          {snapshot.op} · {snapshot.files.length} file{snapshot.files.length === 1 ? "" : "s"}
        </>
      }
      toolbar={
        <>
          <Toggle checked={auto} onChange={setAuto}>
            Apply non-conflicting changes
          </Toggle>
          <Toggle checked={highlight} onChange={setHighlight}>
            Highlight words
          </Toggle>
          <Status>
            {changeBit} {conflictBit}
          </Status>
        </>
      }
      sidebar={
        snapshot.files.length > 1 ? (
          <ChangesTree
            files={snapshot.files.map((f) => ({
              path: f.path,
              status: "modified" as const,
            }))}
            activePath={activePath}
            onSelect={select}
          />
        ) : undefined
      }
      footerSplit
      footer={
        <>
          <Row>
            <Button type="button" onClick={() => acceptAll("ours")}>
              Accept Left
            </Button>
            <Button type="button" onClick={() => acceptAll("theirs")}>
              Accept Right
            </Button>
            <Button type="button" onClick={() => acceptAll("both")}>
              Accept Both
            </Button>
          </Row>
          <Row>
            <Button type="button" onClick={() => void abandon()}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={busy || !resolved.ready || !!file?.skipped}
              onClick={() => void apply()}
            >
              {busy ? "Applying…" : "Apply"}
            </Button>
          </Row>
        </>
      }
    >
      {file?.skipped ? (
        <Msg>
          Skipped {file.path} ({file.skipped}). Resolve this file in your editor, then Apply the
          others.
        </Msg>
      ) : (
        <MergeView />
      )}
    </AppShell>
  );
}
