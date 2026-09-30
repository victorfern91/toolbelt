import { useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChangesTree, type TreeFile } from "../../../web/changes-tree.tsx";
import { AppShell, Button, Msg, Pre, TextArea, Toggle } from "../../../web/chrome.tsx";
import { Diffs } from "./diffs.tsx";
import {
  snapshotAtom,
  errorAtom,
  notesAtom,
  busyAtom,
  doneAtom,
  countsAtom,
  hideWhitespaceAtom,
  loadSnapshotAtom,
  setHideWhitespaceAtom,
  submitAtom,
  activePathAtom,
  selectPathAtom,
} from "./store.ts";

export function App() {
  const snapshot = useAtomValue(snapshotAtom);
  const error = useAtomValue(errorAtom);
  const counts = useAtomValue(countsAtom);
  const busy = useAtomValue(busyAtom);
  const done = useAtomValue(doneAtom);
  const hideWhitespace = useAtomValue(hideWhitespaceAtom);
  const activePath = useAtomValue(activePathAtom);
  const setHideWhitespace = useSetAtom(setHideWhitespaceAtom);
  const selectPath = useSetAtom(selectPathAtom);
  const [notes, setNotes] = useAtom(notesAtom);
  const load = useSetAtom(loadSnapshotAtom);
  const submit = useSetAtom(submitAtom);
  const settledRef = useRef({ done: false, busy: false });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    settledRef.current.done = done != null;
  }, [done]);

  useEffect(() => {
    settledRef.current.busy = busy;
  }, [busy]);

  useEffect(() => {
    const abandon = () => {
      if (settledRef.current.done || settledRef.current.busy) return;
      settledRef.current.done = true;
      navigator.sendBeacon("/api/abandon");
    };
    window.addEventListener("pagehide", abandon);
    return () => window.removeEventListener("pagehide", abandon);
  }, []);

  if (error) return <Msg>{error}</Msg>;
  if (!snapshot) return <Msg>Loading diff…</Msg>;
  if (!snapshot.files.length) return <Msg>No local changes to review.</Msg>;

  return (
    <AppShell
      kind="review"
      badge="review"
      meta={
        <>
          {snapshot.branch} vs {snapshot.base} · {counts.n} files · {counts.approved} accepted ·{" "}
          {counts.unapproved} rejected · {counts.comments} comments
        </>
      }
      actions={
        <>
          <Toggle checked={hideWhitespace} onChange={setHideWhitespace}>
            Hide whitespace
          </Toggle>
          <Button
            variant="primary"
            type="button"
            disabled={busy || done != null}
            onClick={() => void submit()}
          >
            {busy ? "Sending…" : "Submit feedback"}
          </Button>
        </>
      }
      sidebar={
        <ChangesTree
          files={snapshot.files.map((f) => ({
            path: f.path,
            status: f.status as TreeFile["status"],
          }))}
          activePath={activePath}
          onSelect={selectPath}
        />
      }
      footer={
        done != null ? (
          <>
            {done
              ? "Feedback sent. The agent prompt is on stdout (and below). You can close this tab."
              : "No annotations — nothing for the agent to do. You can close this tab."}
            {done ? <Pre>{done}</Pre> : null}
          </>
        ) : (
          <>
            <label htmlFor="notes">Notes for the agent</label>
            <TextArea
              id="notes"
              placeholder="Overall direction, constraints, what to keep…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        )
      }
    >
      <Diffs />
    </AppShell>
  );
}
