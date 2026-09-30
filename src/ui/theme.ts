/** IntelliJ New UI Dark — the only colors this tool paints. Use `color` in Ink, `ansi` on stdout. */
export const color = {
  /** Badge fill, caret, hint keys — IntelliJ accent blue (not Nord purple) */
  chrome: "#3574F0",
  /** Text sitting on `chrome` */
  onChrome: "#FFFFFF",
  /** Labels, current branch, busy */
  accent: "#6B9BFA",
  ok: "#499C54",
  warn: "#C9A54E",
  danger: "#E05765",
} as const;

export type Color = (typeof color)[keyof typeof color];

function hexFg(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}

export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  clearLine: "\x1b[2K\r",
  chrome: hexFg(color.chrome),
  accent: hexFg(color.accent),
  ok: hexFg(color.ok),
  warn: hexFg(color.warn),
  danger: hexFg(color.danger),
} as const;
