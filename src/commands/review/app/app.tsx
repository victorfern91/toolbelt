import { useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChangesTree } from "./changes-tree.tsx";
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
} from "./store.ts";

export function App() {
  const snapshot = useAtomValue(snapshotAtom);
  const error = useAtomValue(errorAtom);
  const counts = useAtomValue(countsAtom);
  const busy = useAtomValue(busyAtom);
  const done = useAtomValue(doneAtom);
  const hideWhitespace = useAtomValue(hideWhitespaceAtom);
  const setHideWhitespace = useSetAtom(setHideWhitespaceAtom);
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

  // Closing the tab with no submit → abandon (no action for the agent).
  useEffect(() => {
    const abandon = () => {
      if (settledRef.current.done || settledRef.current.busy) return;
      settledRef.current.done = true;
      navigator.sendBeacon("/api/abandon");
    };
    window.addEventListener("pagehide", abandon);
    return () => window.removeEventListener("pagehide", abandon);
  }, []);

  if (error) return <div className="msg">{error}</div>;
  if (!snapshot) return <div className="msg">Loading diff…</div>;
  if (!snapshot.files.length) return <div className="msg">No local changes to review.</div>;

  return (
    <div className="app">
      <header className="top">
        <span className="badge">review</span>
        <span className="meta">
          {snapshot.branch} vs {snapshot.base} · {counts.n} files · {counts.approved} accepted ·{" "}
          {counts.unapproved} rejected · {counts.comments} comments
        </span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={hideWhitespace}
            onChange={(e) => setHideWhitespace(e.target.checked)}
          />
          Hide whitespace
        </label>
        <button
          className="primary"
          type="button"
          disabled={busy || done != null}
          onClick={() => void submit()}
        >
          {busy ? "Sending…" : "Submit feedback"}
        </button>
      </header>
      <div className="body">
        <aside className="tree">
          <ChangesTree />
        </aside>
        <section className="main">
          <Diffs />
        </section>
      </div>
      {done != null ? (
        <div className="done">
          {done
            ? "Feedback sent. The agent prompt is on stdout (and below). You can close this tab."
            : "No annotations — nothing for the agent to do. You can close this tab."}
          {done ? <pre>{done}</pre> : null}
        </div>
      ) : (
        <div className="notes">
          <label htmlFor="notes">Notes for the agent</label>
          <textarea
            id="notes"
            placeholder="Overall direction, constraints, what to keep…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
