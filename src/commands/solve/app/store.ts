import { atom } from "jotai";
import type { ConflictFile, ConflictSnapshot } from "../../../capabilities/solve/types.ts";
import {
  conflictCount,
  dropRegionSide,
  materialize,
  mergeFiles,
  pendingChangeCount,
  splitLines,
  toggleRegionSide,
  type MergeRegion,
  type PickSide,
} from "../../../capabilities/solve/merge.ts";

export type FileState = {
  picks: Record<string, PickSide>;
  manual: Record<string, string[]>;
  override: string | null;
};

const emptyState = (): FileState => ({ picks: {}, manual: {}, override: null });

export const snapshotAtom = atom<ConflictSnapshot | null>(null);
export const errorAtom = atom("");
export const activePathAtom = atom<string | null>(null);
export const filesStateAtom = atom<Record<string, FileState>>({});
export const autoNonConflictAtom = atom(true);
export const highlightWordsAtom = atom(true);
export const busyAtom = atom(false);
export const doneAtom = atom<"applied" | "abandoned" | null>(null);

export const activeFileAtom = atom((get): ConflictFile | null => {
  const snap = get(snapshotAtom);
  const path = get(activePathAtom);
  return snap?.files.find((f) => f.path === path) ?? null;
});

export const regionsAtom = atom((get): MergeRegion[] => {
  const file = get(activeFileAtom);
  if (!file || file.skipped) return [];
  return mergeFiles(file.base ?? "", file.ours ?? "", file.theirs ?? "");
});

export const activeStateAtom = atom((get): FileState => {
  const path = get(activePathAtom);
  if (!path) return emptyState();
  return get(filesStateAtom)[path] ?? emptyState();
});

export const eofNewlineAtom = atom((get) => {
  const file = get(activeFileAtom);
  if (!file) return true;
  const texts = [file.ours, file.theirs, file.base].filter((s): s is string => s != null);
  return texts.some((t) => t.endsWith("\n"));
});

export const materializedAtom = atom((get) => {
  const file = get(activeFileAtom);
  const regions = get(regionsAtom);
  const state = get(activeStateAtom);
  const auto = get(autoNonConflictAtom);
  const eof = get(eofNewlineAtom);
  if (!file || file.skipped) {
    return { text: "", unresolved: [] as string[], contents: null as string | null, ready: false };
  }
  const { text, unresolved } = materialize(regions, state.picks, state.manual, auto, eof);
  const del = text === "" && unresolved.length === 0 && (file.ours == null || file.theirs == null);
  return {
    text,
    unresolved,
    contents: del ? null : text,
    ready: unresolved.length === 0,
  };
});

export const resolvedAtom = atom((get) => {
  const override = get(activeStateAtom).override;
  if (override != null) {
    return {
      text: override,
      unresolved: [] as string[],
      contents: override,
      ready: true,
    };
  }
  return get(materializedAtom);
});

export const statsAtom = atom((get) => {
  const regions = get(regionsAtom);
  const state = get(activeStateAtom);
  const auto = get(autoNonConflictAtom);
  const resolved = get(resolvedAtom);
  return {
    conflicts: conflictCount(regions),
    remaining: resolved.unresolved.length,
    changes: pendingChangeCount(regions, state.picks, auto),
  };
});

export const loadSnapshotAtom = atom(null, async (_get, set) => {
  const res = await fetch("/api/snapshot");
  if (!res.ok) {
    set(errorAtom, `failed to load snapshot (${res.status})`);
    return;
  }
  const data = (await res.json()) as ConflictSnapshot;
  set(snapshotAtom, data);
  set(activePathAtom, data.files[0]?.path ?? null);
});

export const selectPathAtom = atom(null, (_get, set, path: string) => {
  set(activePathAtom, path);
});

export const setAutoNonConflictAtom = atom(null, (_get, set, value: boolean) => {
  set(autoNonConflictAtom, value);
});

export const setHighlightWordsAtom = atom(null, (_get, set, value: boolean) => {
  set(highlightWordsAtom, value);
});

const patchFile = (
  get: () => Record<string, FileState>,
  set: (v: Record<string, FileState>) => void,
  path: string,
  fn: (s: FileState) => FileState,
) => {
  const all = get();
  set({ ...all, [path]: fn(all[path] ?? emptyState()) });
};

const writePick = (s: FileState, regionId: string, pick: PickSide | undefined): FileState => {
  const picks = { ...s.picks };
  if (pick == null) delete picks[regionId];
  else picks[regionId] = pick;
  const manual = Object.fromEntries(Object.entries(s.manual).filter(([id]) => id !== regionId));
  return { picks, manual, override: null };
};

export const pickRegionAtom = atom(
  null,
  (get, set, { regionId, pick }: { regionId: string; pick: PickSide }) => {
    const path = get(activePathAtom);
    if (!path) return;
    patchFile(
      () => get(filesStateAtom),
      (v) => set(filesStateAtom, v),
      path,
      (s) => writePick(s, regionId, pick),
    );
  },
);

export const toggleSideAtom = atom(
  null,
  (get, set, { regionId, side }: { regionId: string; side: "ours" | "theirs" }) => {
    const path = get(activePathAtom);
    const region = get(regionsAtom).find((r) => r.id === regionId);
    if (!path || !region) return;
    const auto = get(autoNonConflictAtom);
    patchFile(
      () => get(filesStateAtom),
      (v) => set(filesStateAtom, v),
      path,
      (s) => writePick(s, regionId, toggleRegionSide(region, s.picks[regionId], side, auto)),
    );
  },
);

export const rejectRegionAtom = atom(
  null,
  (get, set, { regionId, side }: { regionId: string; side: "ours" | "theirs" }) => {
    const path = get(activePathAtom);
    const region = get(regionsAtom).find((r) => r.id === regionId);
    if (!path || !region) return;
    const auto = get(autoNonConflictAtom);
    patchFile(
      () => get(filesStateAtom),
      (v) => set(filesStateAtom, v),
      path,
      (s) => writePick(s, regionId, dropRegionSide(region, s.picks[regionId], side, auto)),
    );
  },
);

export const acceptAllAtom = atom(null, (get, set, side: "ours" | "theirs" | "both") => {
  const path = get(activePathAtom);
  const regions = get(regionsAtom);
  if (!path) return;
  const picks: Record<string, PickSide> = {};
  for (const r of regions) {
    if (r.kind === "conflict" || r.kind === "ours" || r.kind === "theirs") picks[r.id] = side;
  }
  patchFile(
    () => get(filesStateAtom),
    (v) => set(filesStateAtom, v),
    path,
    (s) => ({ picks: { ...s.picks, ...picks }, manual: {}, override: null }),
  );
});

export const editRegionAtom = atom(
  null,
  (get, set, { regionId, lines }: { regionId: string; lines: string[] }) => {
    const path = get(activePathAtom);
    if (!path) return;
    patchFile(
      () => get(filesStateAtom),
      (v) => set(filesStateAtom, v),
      path,
      (s) => ({
        picks: s.picks,
        manual: { ...s.manual, [regionId]: lines },
        override: s.override,
      }),
    );
  },
);

export const editResultAtom = atom(null, (get, set, contents: string) => {
  const path = get(activePathAtom);
  if (!path) return;
  patchFile(
    () => get(filesStateAtom),
    (v) => set(filesStateAtom, v),
    path,
    (s) => ({ ...s, override: contents }),
  );
});

export const applyCurrentAtom = atom(null, async (get, set) => {
  const snap = get(snapshotAtom);
  const file = get(activeFileAtom);
  const resolved = get(resolvedAtom);
  if (!snap || !file || !resolved.ready || get(busyAtom) || get(doneAtom) != null) return;
  set(busyAtom, true);
  const res = await fetch("/api/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: [{ path: file.path, contents: resolved.contents }] }),
  });
  if (!res.ok) {
    set(errorAtom, `apply failed (${res.status})`);
    set(busyAtom, false);
    return;
  }
  const data = (await res.json()) as { remaining: string[] };
  const remaining = new Set(data.remaining);
  const files = snap.files.filter((f) => remaining.has(f.path));
  set(snapshotAtom, { ...snap, files });
  set(activePathAtom, files[0]?.path ?? null);
  set(busyAtom, false);
  if (!files.length) set(doneAtom, "applied");
});

export const abandonAtom = atom(null, async (get, set) => {
  if (get(doneAtom) != null) return;
  set(doneAtom, "abandoned");
  await fetch("/api/abandon", { method: "POST" });
});

export const fileConflictCount = (file: ConflictFile) => {
  if (file.skipped) return 0;
  return conflictCount(mergeFiles(file.base ?? "", file.ours ?? "", file.theirs ?? ""));
};

export const lineCount = (text: string | null) =>
  text == null ? 0 : splitLines(text).lines.length;
