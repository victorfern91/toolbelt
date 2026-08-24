/** Nord — the only colors this tool paints. Use `color` in Ink, `ansi` on stdout. */
export const color = {
  /** Badge fill, caret, hint keys */
  chrome: "#B48EAD",
  /** Text sitting on `chrome` */
  onChrome: "#2E3440",
  /** Labels, current branch, busy */
  accent: "#88C0D0",
  ok: "#A3BE8C",
  warn: "#EBCB8B",
  danger: "#BF616A",
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
