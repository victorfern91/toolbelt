/** Pierre chrome — grey hairlines, GitHub-dark diff fills, theme token colors untouched. */
export const pierreUnsafeCSS = /* css */ `
:host {
  --diffs-font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --diffs-font-size: 13px;
  --diffs-header-font-family: system-ui, -apple-system, sans-serif;
  --diffs-addition-color-override: #3fb950;
  --diffs-deletion-color-override: #f85149;
  /* drives selection tint + the hover "+" button */
  --diffs-modified-color-override: #388bfd;
  --diffs-bg-addition-override: #1d3326;
  --diffs-bg-addition-number-override: #22432d;
  --diffs-bg-addition-emphasis-override: #2c5a37;
  --diffs-bg-deletion-override: #3a2226;
  --diffs-bg-deletion-number-override: #4a272b;
  --diffs-bg-deletion-emphasis-override: #6b2f33;
}

[data-header],
[data-separator],
[data-separator-wrapper],
[data-column-number],
[data-gutter],
[data-content],
[data-line],
[data-file] {
  border-color: #2a2c2e !important;
  box-shadow: none !important;
}

[data-header] {
  color: #7a7e85;
  background: #2b2d30;
  border-bottom: 1px solid #2a2c2e !important;
}

[data-column-number] {
  color: #5c6066;
  border-right: 1px solid #2a2c2e !important;
  cursor: pointer;
}

[data-line-type="change-addition"],
[data-line-type="change-deletion"] {
  cursor: pointer;
}

[data-utility-button] {
  background-color: #1f6feb;
  color: #fff;
  transition: transform 80ms ease-out;
}

[data-utility-button]:hover {
  transform: scale(1.15);
}
`;

/** diffs.com Pierre — shared by review CodeView and solve FileDiff panes. */
export const pierreBase = {
  theme: "pierre-dark" as const,
  themeType: "dark" as const,
  preferredHighlighter: "shiki-js" as const,
  overflow: "wrap" as const,
  diffIndicators: "classic" as const,
  unsafeCSS: pierreUnsafeCSS,
};

export const pierreFileOptions = {
  ...pierreBase,
  stickyHeader: true as const,
};

export const pierreDiffOptions = (
  lineDiffType: "word" | "none" = "word",
  extra?: {
    onLineClick?: (props: { lineNumber: number; side: "deletions" | "additions" }) => void;
  },
) => ({
  ...pierreFileOptions,
  hunkSeparators: "line-info-basic" as const,
  diffStyle: "unified" as const,
  lineDiffType,
  lineHoverHighlight: "line" as const,
  disableBackground: false as const,
  ...extra,
});
