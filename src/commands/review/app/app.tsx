import { useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChangesTree } from "./changes-tree.tsx";
import { Diffs } from "./diffs.tsx";
import {
  snapshotAtom,
  errorAtom,
  draftAtom,
  notesAtom,
  busyAtom,
  doneAtom,
  countsAtom,
  loadSnapshotAtom,
  addCommentAtom,
  submitAtom,
} from "./store.ts";

const rangeLabel = (start: number, end: number) =>
  start === end ? `L${start}` : `L${start}–${end}`;

export function App() {
  const snapshot = useAtomValue(snapshotAtom);
  const error = useAtomValue(errorAtom);
  const counts = useAtomValue(countsAtom);
  const busy = useAtomValue(busyAtom);
  const done = useAtomValue(doneAtom);
  const [draft, setDraft] = useAtom(draftAtom);
  const [notes, setNotes] = useAtom(notesAtom);
  const load = useSetAtom(loadSnapshotAtom);
  const addComment = useSetAtom(addCommentAtom);
  const submit = useSetAtom(submitAtom);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="msg">{error}</div>;
  if (!snapshot) return <div className="msg">Loading diff…</div>;
  if (!snapshot.files.length) return <div className="msg">No local changes to review.</div>;

  return (
    <div className="app">
      <header className="top">
        <span className="badge">review</span>
        <span className="meta">
          {snapshot.branch} vs {snapshot.base} · {counts.n} files · {counts.approved} approved ·{" "}
          {counts.unapproved} unapproved · {counts.comments} comments
        </span>
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
      {draft ? (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            addComment();
          }}
        >
          <div className="row">
            Comment on {draft.path} {rangeLabel(draft.range.start, draft.range.end)} (
            {draft.range.side ?? "additions"})
          </div>
          <textarea
            autoFocus
            placeholder="What should the agent change here?"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                addComment();
              }
              if (e.key === "Escape") setDraft(null);
            }}
          />
          <div className="row">
            <button className="primary" type="submit" disabled={!draft.body.trim()}>
              Add comment
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {done ? (
        <div className="done">
          Feedback sent. The agent prompt is on stdout (and below). You can close this tab.
          <pre>{done}</pre>
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
