/** Pierre chrome — grey hairlines, keep add/delete fills. */
export const pierreUnsafeCSS = /* css */ `
:host {
  --diffs-font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --diffs-font-size: 13px;
  --diffs-header-font-family: system-ui, -apple-system, sans-serif;
  --diffs-addition-color-override: #2a3f32;
  --diffs-deletion-color-override: #3f2a2e;
  --diffs-modified-color-override: #323844;
  color: #8b8e94;
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
}

[data-line-type="change-addition"],
[data-line-type="change-addition"] [data-line],
[data-line-type="change-addition"] [data-gutter],
[data-line-type="change-addition"] [data-column-number] {
  background-color: #24352c !important;
}

[data-line-type="change-deletion"],
[data-line-type="change-deletion"] [data-line],
[data-line-type="change-deletion"] [data-gutter],
[data-line-type="change-deletion"] [data-column-number] {
  background-color: #3a282b !important;
}

[data-line-type="change-addition"],
[data-line-type="change-deletion"] {
  cursor: pointer;
}

[data-line] span {
  color: color-mix(in oklab, currentColor 18%, #7a7e85) !important;
}

[data-line][data-line-type="change-addition"] span {
  color: color-mix(in oklab, currentColor 35%, #7d9a80) !important;
}

[data-line][data-line-type="change-deletion"] span {
  color: color-mix(in oklab, currentColor 35%, #a8888c) !important;
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
