import { useCallback, useMemo } from "react";
import type { CodeViewItem, CodeViewReactOptions, DiffLineAnnotation } from "@pierre/diffs/react";
import { CodeView } from "@pierre/diffs/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  itemsAtom,
  viewerAtom,
  startDraftAtom,
  removeCommentAtom,
  cancelDraftAtom,
  addCommentAtom,
  toggleVerdictAtom,
  toggleEditingAtom,
  recordEditAtom,
  hideWhitespaceAtom,
  draftRangeAtom,
  draftBodyAtom,
  verdictsAtom,
  editingAtom,
  type CommentMeta,
} from "./store.ts";

function FileActions({ path, canEdit }: { path: string; canEdit: boolean }) {
  const verdict = useAtomValue(verdictsAtom)[path] ?? "pending";
  const editing = useAtomValue(editingAtom)[path] ?? false;
  const toggleVerdict = useSetAtom(toggleVerdictAtom);
  const toggleEditing = useSetAtom(toggleEditingAtom);
  return (
    <span className="file-actions">
      <button
        type="button"
        className={verdict === "approved" ? "ok active" : "ok"}
        onClick={() => toggleVerdict({ path, verdict: "approved" })}
      >
        Accept
      </button>
      <button
        type="button"
        className={verdict === "unapproved" ? "danger active" : "danger"}
        onClick={() => toggleVerdict({ path, verdict: "unapproved" })}
      >
        {verdict === "unapproved" ? "Rejected" : "Reject Changes"}
      </button>
      {canEdit ? (
        <button
          type="button"
          className={editing ? "active" : ""}
          onClick={() => toggleEditing(path)}
        >
          {editing ? "Editing" : "Edit"}
        </button>
      ) : null}
    </span>
  );
}

function Note({ annotation }: { annotation: DiffLineAnnotation<CommentMeta> }) {
  const remove = useSetAtom(removeCommentAtom);
  const meta = annotation.metadata;
  const range =
    meta.endLine === annotation.lineNumber
      ? `L${annotation.lineNumber}`
      : `L${annotation.lineNumber}–${meta.endLine}`;
  return (
    <div className="note">
      <div className="note-head">
        <span>Comment {range}</span>
        <button type="button" onClick={() => remove(meta.id)} aria-label="Remove comment">
          ×
        </button>
      </div>
      <p>{meta.body}</p>
    </div>
  );
}

function DraftNote() {
  const range = useAtomValue(draftRangeAtom);
  const [body, setBody] = useAtom(draftBodyAtom);
  const addComment = useSetAtom(addCommentAtom);
  const cancel = useSetAtom(cancelDraftAtom);
  if (!range) return null;
  const start = Math.min(range.range.start, range.range.end);
  const end = Math.max(range.range.start, range.range.end);
  const label = start === end ? `L${start}` : `L${start}–${end}`;
  return (
    <form
      className="note note-draft"
      onSubmit={(e) => {
        e.preventDefault();
        addComment();
      }}
    >
      <div className="note-head">Comment {label}</div>
      <textarea
        autoFocus
        placeholder="Add a comment on this change…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            addComment();
          }
          if (e.key === "Escape") cancel();
        }}
      />
      <div className="row">
        <button className="primary" type="submit" disabled={!body.trim()}>
          Add comment
        </button>
        <button type="button" onClick={() => cancel()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Diffs() {
  const items = useAtomValue(itemsAtom);
  const hideWhitespace = useAtomValue(hideWhitespaceAtom);
  const setViewer = useSetAtom(viewerAtom);
  const startDraft = useSetAtom(startDraftAtom);
  const recordEdit = useSetAtom(recordEditAtom);

  const options = useMemo<CodeViewReactOptions<CommentMeta>>(
    () => ({
      theme: "pierre-dark",
      themeType: "dark",
      diffStyle: "split",
      diffIndicators: "classic",
      overflow: "wrap",
      enableLineSelection: true,
      enableGutterUtility: true,
      hunkSeparators: "line-info-basic",
      preferredHighlighter: "shiki-js",
      lineHoverHighlight: "line",
      stickyHeaders: true,
      parseDiffOptions: hideWhitespace ? { ignoreWhitespace: true } : undefined,
      layout: { paddingTop: 12, paddingBottom: 16, gap: 16 },
      onGutterUtilityClick: (range, context) => {
        startDraft({ path: context.item.id, range });
      },
      onLineSelected: (range, context) => {
        if (range) startDraft({ path: context.item.id, range });
      },
    }),
    [hideWhitespace, startDraft],
  );

  const editorOptions = useMemo(() => ({ persistState: true }), []);

  const renderHeaderMetadata = useCallback(
    (item: CodeViewItem<CommentMeta>) => (
      <FileActions path={item.id} canEdit={item.type === "diff"} />
    ),
    [],
  );

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<CommentMeta> | { lineNumber: number }) => {
      if (!("side" in annotation)) return null;
      if (annotation.metadata.draft) return <DraftNote />;
      return <Note annotation={annotation} />;
    },
    [],
  );

  return (
    <CodeView<CommentMeta>
      ref={setViewer}
      className="diffs"
      style={{ overflow: "auto" }}
      items={items}
      options={options}
      editorOptions={editorOptions}
      renderHeaderMetadata={renderHeaderMetadata}
      renderAnnotation={renderAnnotation}
      onItemEditChange={(item, file) => recordEdit({ path: item.id, contents: file.contents })}
      disableWorkerPool
    />
  );
}
