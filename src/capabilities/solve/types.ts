export type ConflictOp = "merge" | "rebase" | "cherry-pick" | "revert";
export type SkipReason = "binary" | "too-large";

export type ConflictFile = {
  path: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  skipped?: SkipReason;
};

export type ConflictSnapshot = {
  root: string;
  op: ConflictOp;
  oursLabel: string;
  theirsLabel: string;
  files: ConflictFile[];
};

export type ApplyFile = {
  path: string;
  /** `null` deletes the file from the worktree and index. */
  contents: string | null;
};
