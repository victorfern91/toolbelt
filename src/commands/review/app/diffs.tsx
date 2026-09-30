import { useCallback, useMemo } from "react";
import type { CodeViewItem, CodeViewReactOptions, DiffLineAnnotation } from "@pierre/diffs/react";
import { CodeView } from "@pierre/diffs/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Button, Fill, Note, NoteBody, NoteHead, Row, TextArea } from "../../../web/chrome.tsx";
import { pierreBase } from "../../../web/pierre.ts";
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
    <Row>
      <Button
        type="button"
        variant="ok"
        active={verdict === "approved"}
        onClick={() => toggleVerdict({ path, verdict: "approved" })}
      >
        Accept
      </Button>
      <Button
        type="button"
        variant="danger"
        active={verdict === "unapproved"}
        onClick={() => toggleVerdict({ path, verdict: "unapproved" })}
      >
        {verdict === "unapproved" ? "Rejected" : "Reject Changes"}
      </Button>
      {canEdit ? (
        <Button type="button" active={editing} onClick={() => toggleEditing(path)}>
          {editing ? "Editing" : "Edit"}
        </Button>
      ) : null}
    </Row>
  );
}

function NoteView({ annotation }: { annotation: DiffLineAnnotation<CommentMeta> }) {
  const remove = useSetAtom(removeCommentAtom);
  const meta = annotation.metadata;
  const range =
    meta.endLine === annotation.lineNumber
      ? `L${annotation.lineNumber}`
      : `L${annotation.lineNumber}–${meta.endLine}`;
  return (
    <Note>
      <NoteHead>
        <span>Comment {range}</span>
        <Button type="button" onClick={() => remove(meta.id)} aria-label="Remove comment">
          ×
        </Button>
      </NoteHead>
      <NoteBody>{meta.body}</NoteBody>
    </Note>
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
    <Note draft>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addComment();
        }}
      >
        <NoteHead>Comment {label}</NoteHead>
        <TextArea
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
        <Row>
          <Button variant="primary" type="submit" disabled={!body.trim()}>
            Add comment
          </Button>
          <Button type="button" onClick={() => cancel()}>
            Cancel
          </Button>
        </Row>
      </form>
    </Note>
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
      ...pierreBase,
      stickyHeaders: true,
      hunkSeparators: "line-info-basic",
      diffStyle: "split",
      enableLineSelection: true,
      enableGutterUtility: true,
      lineHoverHighlight: "line",
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
      return <NoteView annotation={annotation} />;
    },
    [],
  );

  return (
    <Fill>
      <CodeView<CommentMeta>
        ref={setViewer}
        style={{ overflow: "auto", height: "100%" }}
        items={items}
        options={options}
        editorOptions={editorOptions}
        renderHeaderMetadata={renderHeaderMetadata}
        renderAnnotation={renderAnnotation}
        onItemEditChange={(item, file) => recordEdit({ path: item.id, contents: file.contents })}
        disableWorkerPool
      />
    </Fill>
  );
}
