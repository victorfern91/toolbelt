export type FileStatus = "added" | "deleted" | "modified" | "renamed" | "untracked";
export type Verdict = "approved" | "unapproved" | "pending";
export type AnnotationSide = "additions" | "deletions";
export type SkipReason = "binary" | "too-large";

export type ReviewFile = {
  path: string;
  status: FileStatus;
  oldPath?: string;
  oldContents: string | null;
  newContents: string | null;
  skipped?: SkipReason;
};

export type ReviewSnapshot = {
  root: string;
  branch: string;
  base: "HEAD";
  files: ReviewFile[];
};

export type ReviewComment = {
  id: string;
  path: string;
  side: AnnotationSide;
  startLine: number;
  endLine: number;
  body: string;
};

export type ReviewEdit = {
  path: string;
  contents: string;
};

export type FileVerdict = {
  path: string;
  verdict: Verdict;
};

export type ReviewFeedback = {
  notes: string;
  files: FileVerdict[];
  comments: ReviewComment[];
  edits: ReviewEdit[];
};
