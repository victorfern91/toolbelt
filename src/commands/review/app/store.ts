import { atom, type Getter, type Setter } from "jotai";
import { parseDiffFromFile, type FileDiffMetadata, type SelectedLineRange } from "@pierre/diffs";
import type { CodeViewHandle, CodeViewItem } from "@pierre/diffs/react";
import type {
  ReviewComment,
  ReviewFeedback,
  ReviewSnapshot,
  Verdict,
} from "../../../capabilities/review/types.ts";

export type CommentMeta = { id: string; body: string; endLine: number; draft?: boolean };

const parseSnapshotDiffs = (data: ReviewSnapshot, hideWhitespace: boolean) => {
  const diffs: Record<string, FileDiffMetadata> = {};
  const opts = hideWhitespace ? { ignoreWhitespace: true } : undefined;
  const tag = hideWhitespace ? "hide-ws" : "show-ws";
  for (const file of data.files) {
    if (file.skipped) continue;
    const name = file.path;
    const oldFile =
      file.oldContents == null
        ? null
        : { name, contents: file.oldContents, cacheKey: `${name}:old:${tag}` };
    const newFile =
      file.newContents == null
        ? null
        : { name, contents: file.newContents, cacheKey: `${name}:new:${tag}` };
    if (oldFile == null && newFile == null) continue;
    diffs[name] = parseDiffFromFile(oldFile, newFile, opts);
  }
  return diffs;
};

export type DraftRange = {
  path: string;
  range: SelectedLineRange;
};

const newId = () => crypto.randomUUID();

export const snapshotAtom = atom<ReviewSnapshot | null>(null);
export const errorAtom = atom("");
export const fileDiffsAtom = atom<Record<string, FileDiffMetadata>>({});
export const activePathAtom = atom<string | null>(null);
export const verdictsAtom = atom<Record<string, Verdict>>({});
export const commentsAtom = atom<ReviewComment[]>([]);
export const editsAtom = atom<Record<string, string>>({});
export const notesAtom = atom("");
export const hideWhitespaceAtom = atom(true);
export const draftRangeAtom = atom<DraftRange | null>(null);
export const draftBodyAtom = atom("");
export const editingAtom = atom<Record<string, boolean>>({});
export const versionsAtom = atom<Record<string, number>>({});
export const busyAtom = atom(false);
export const doneAtom = atom<string | null>(null);
export const viewerAtom = atom<CodeViewHandle<CommentMeta> | null>(null);

const bump = (get: Getter, set: Setter, path: string) => {
  const versions = get(versionsAtom);
  set(versionsAtom, { ...versions, [path]: (versions[path] ?? 0) + 1 });
};

export const countsAtom = atom((get) => {
  const files = get(snapshotAtom)?.files ?? [];
  const verdicts = get(verdictsAtom);
  const of = (v: Verdict) => files.filter((f) => (verdicts[f.path] ?? "pending") === v).length;
  return {
    n: files.length,
    approved: of("approved"),
    unapproved: of("unapproved"),
    comments: get(commentsAtom).length,
  };
});

export const itemsAtom = atom((get) => {
  const snapshot = get(snapshotAtom);
  const fileDiffs = get(fileDiffsAtom);
  const comments = get(commentsAtom);
  const editing = get(editingAtom);
  const versions = get(versionsAtom);
  const draftRange = get(draftRangeAtom);
  if (!snapshot) return [] as CodeViewItem<CommentMeta>[];
  return snapshot.files.flatMap((file): CodeViewItem<CommentMeta>[] => {
    if (file.skipped) {
      return [
        {
          id: file.path,
          type: "file",
          file: {
            name: file.path,
            contents: `Skipped (${file.skipped}).`,
            cacheKey: `${file.path}:skipped`,
          },
          version: versions[file.path] ?? 0,
        },
      ];
    }
    const fileDiff = fileDiffs[file.path];
    if (!fileDiff) return [];
    return [
      {
        id: file.path,
        type: "diff",
        fileDiff,
        annotations: [
          ...comments
            .filter((c) => c.path === file.path)
            .map((c) => ({
              side: c.side,
              lineNumber: c.startLine,
              metadata: { id: c.id, body: c.body, endLine: c.endLine },
            })),
          ...(draftRange && draftRange.path === file.path
            ? [
                {
                  side: (draftRange.range.side === "deletions"
                    ? "deletions"
                    : "additions") as const,
                  lineNumber: Math.min(draftRange.range.start, draftRange.range.end),
                  metadata: {
                    id: "__draft__",
                    body: "",
                    endLine: Math.max(draftRange.range.start, draftRange.range.end),
                    draft: true,
                  },
                },
              ]
            : []),
        ],
        edit: editing[file.path] ?? false,
        version: versions[file.path] ?? 0,
      },
    ];
  });
});

export const loadSnapshotAtom = atom(null, async (get, set) => {
  const res = await fetch("/api/snapshot");
  if (!res.ok) {
    set(errorAtom, `failed to load snapshot (${res.status})`);
    return;
  }
  const data = (await res.json()) as ReviewSnapshot;
  set(snapshotAtom, data);
  set(fileDiffsAtom, parseSnapshotDiffs(data, get(hideWhitespaceAtom)));
  set(activePathAtom, data.files[0]?.path ?? null);
});

export const setHideWhitespaceAtom = atom(null, (get, set, hide: boolean) => {
  if (get(hideWhitespaceAtom) === hide) return;
  set(hideWhitespaceAtom, hide);
  const snapshot = get(snapshotAtom);
  if (!snapshot) return;
  set(fileDiffsAtom, parseSnapshotDiffs(snapshot, hide));
  const versions = { ...get(versionsAtom) };
  for (const file of snapshot.files) versions[file.path] = (versions[file.path] ?? 0) + 1;
  set(versionsAtom, versions);
});

export const startDraftAtom = atom(
  null,
  (get, set, { path, range }: { path: string; range: SelectedLineRange }) => {
    const prev = get(draftRangeAtom);
    set(draftRangeAtom, { path, range });
    set(draftBodyAtom, "");
    if (get(editingAtom)[path]) {
      set(editingAtom, { ...get(editingAtom), [path]: false });
    }
    if (prev && prev.path !== path) bump(get, set, prev.path);
    bump(get, set, path);
  },
);

export const cancelDraftAtom = atom(null, (get, set) => {
  const draft = get(draftRangeAtom);
  if (!draft) return;
  set(draftRangeAtom, null);
  set(draftBodyAtom, "");
  bump(get, set, draft.path);
});

export const addCommentAtom = atom(null, (get, set) => {
  const draft = get(draftRangeAtom);
  const body = get(draftBodyAtom).trim();
  if (!draft || !body) return;
  const start = Math.min(draft.range.start, draft.range.end);
  const end = Math.max(draft.range.start, draft.range.end);
  set(commentsAtom, [
    ...get(commentsAtom),
    {
      id: newId(),
      path: draft.path,
      side: draft.range.side === "deletions" ? "deletions" : "additions",
      startLine: start,
      endLine: end,
      body,
    },
  ]);
  set(draftRangeAtom, null);
  set(draftBodyAtom, "");
  bump(get, set, draft.path);
});

export const removeCommentAtom = atom(null, (get, set, id: string) => {
  const comments = get(commentsAtom);
  const comment = comments.find((c) => c.id === id);
  if (!comment) return;
  set(
    commentsAtom,
    comments.filter((c) => c.id !== id),
  );
  bump(get, set, comment.path);
});

export const toggleVerdictAtom = atom(
  null,
  (get, set, { path, verdict }: { path: string; verdict: Verdict }) => {
    const current = get(verdictsAtom);
    set(verdictsAtom, {
      ...current,
      [path]: current[path] === verdict ? "pending" : verdict,
    });
  },
);

export const toggleEditingAtom = atom(null, (get, set, path: string) => {
  set(editingAtom, { ...get(editingAtom), [path]: !get(editingAtom)[path] });
  bump(get, set, path);
});

export const recordEditAtom = atom(
  null,
  (get, set, { path, contents }: { path: string; contents: string }) => {
    set(editsAtom, { ...get(editsAtom), [path]: contents });
  },
);

export const selectPathAtom = atom(null, (get, set, path: string) => {
  set(activePathAtom, path);
  get(viewerAtom)?.scrollTo({ type: "item", id: path, align: "start", behavior: "smooth" });
});

export const submitAtom = atom(null, async (get, set) => {
  const snapshot = get(snapshotAtom);
  if (!snapshot || get(busyAtom) || get(doneAtom) != null) return;
  set(busyAtom, true);
  const verdicts = get(verdictsAtom);
  const edits = get(editsAtom);
  const feedback: ReviewFeedback = {
    notes: get(notesAtom),
    files: snapshot.files.map((f) => ({ path: f.path, verdict: verdicts[f.path] ?? "pending" })),
    comments: get(commentsAtom),
    edits: Object.entries(edits)
      .filter(([path, contents]) => {
        const file = snapshot.files.find((f) => f.path === path);
        return file != null && contents !== file.newContents;
      })
      .map(([path, contents]) => ({ path, contents })),
  };
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(feedback),
  });
  if (!res.ok) {
    set(errorAtom, `submit failed (${res.status})`);
    set(busyAtom, false);
    return;
  }
  const data = (await res.json()) as { prompt: string };
  set(doneAtom, data.prompt);
  set(busyAtom, false);
});
