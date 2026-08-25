import { useCallback, useMemo } from "react";
import type { CodeViewItem, CodeViewReactOptions, DiffLineAnnotation } from "@pierre/diffs/react";
import { CodeView } from "@pierre/diffs/react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  itemsAtom,
  viewerAtom,
  startDraftAtom,
  removeCommentAtom,
  toggleVerdictAtom,
  toggleEditingAtom,
  recordEditAtom,
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
        Approve
      </button>
      <button
        type="button"
        className={verdict === "unapproved" ? "danger active" : "danger"}
        onClick={() => toggleVerdict({ path, verdict: "unapproved" })}
      >
        Unapprove
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
        <span>
          {annotation.side} {range}
        </span>
        <button type="button" onClick={() => remove(meta.id)} aria-label="Remove comment">
          ×
        </button>
      </div>
      <p>{meta.body}</p>
    </div>
  );
}

export function Diffs() {
  const items = useAtomValue(itemsAtom);
  const setViewer = useSetAtom(viewerAtom);
  const startDraft = useSetAtom(startDraftAtom);
  const recordEdit = useSetAtom(recordEditAtom);

  const options = useMemo<CodeViewReactOptions<CommentMeta>>(
    () => ({
      theme: "pierre-dark",
      themeType: "dark",
      diffStyle: "unified",
      overflow: "wrap",
      enableLineSelection: true,
      enableGutterUtility: true,
      hunkSeparators: "line-info-basic",
      preferredHighlighter: "shiki-js",
      lineHoverHighlight: "line",
      stickyHeaders: true,
      layout: { paddingTop: 12, paddingBottom: 16, gap: 16 },
      onGutterUtilityClick: (range, context) => {
        startDraft({ path: context.item.id, range });
      },
      onLineSelected: (range, context) => {
        if (range) startDraft({ path: context.item.id, range });
      },
    }),
    [startDraft],
  );

  const editorOptions = useMemo(() => ({ persistState: true }), []);

  const renderHeaderMetadata = useCallback(
    (item: CodeViewItem<CommentMeta>) => (
      <FileActions path={item.id} canEdit={item.type === "diff"} />
    ),
    [],
  );

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<CommentMeta> | { lineNumber: number }) =>
      "side" in annotation ? <Note annotation={annotation} /> : null,
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
