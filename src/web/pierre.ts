/** diffs.com Pierre dark — shared by review CodeView and solve FileDiff panes. */
export const pierreBase = {
  theme: "pierre-dark" as const,
  themeType: "dark" as const,
  preferredHighlighter: "shiki-js" as const,
  overflow: "wrap" as const,
  diffIndicators: "classic" as const,
};

export const pierreFileOptions = {
  ...pierreBase,
  stickyHeader: true as const,
};

export const pierreDiffOptions = (lineDiffType: "word" | "none" = "word") => ({
  ...pierreFileOptions,
  hunkSeparators: "line-info-basic" as const,
  diffStyle: "unified" as const,
  lineDiffType,
});
