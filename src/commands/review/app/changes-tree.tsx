import { useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { FileTree, useFileTree } from "@pierre/trees/react";
import type { GitStatusEntry } from "@pierre/trees";
import { snapshotAtom, activePathAtom, selectPathAtom } from "./store.ts";

const parents = (path: string) => {
  const parts = path.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
};

export function ChangesTree() {
  const snapshot = useAtomValue(snapshotAtom);
  const activePath = useAtomValue(activePathAtom);
  const selectPath = useSetAtom(selectPathAtom);
  const files = snapshot?.files ?? [];
  const paths = useMemo(() => files.map((f) => f.path), [files]);
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => files.map((f) => ({ path: f.path, status: f.status })),
    [files],
  );
  const expanded = useMemo(() => [...new Set(files.flatMap((f) => parents(f.path)))], [files]);
  const { model } = useFileTree({
    paths,
    gitStatus,
    icons: "standard",
    density: "compact",
    flattenEmptyDirectories: true,
    initialExpandedPaths: expanded,
    initialSelectedPaths: activePath ? [activePath] : paths.slice(0, 1),
    onSelectionChange: (selected) => {
      const path = selected.find((p) => files.some((f) => f.path === p));
      if (path) selectPath(path);
    },
  });

  return (
    <FileTree
      model={model}
      className="tree-host"
      style={{
        height: "100%",
        colorScheme: "dark",
        backgroundColor: "transparent",
      }}
    />
  );
}
