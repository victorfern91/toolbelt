import { expect, test } from "bun:test";
import { ansi, color } from "./theme.ts";

test("ansi codes are truecolor IntelliJ dark", () => {
  expect(color.accent).toBe("#6B9BFA");
  expect(ansi.accent).toBe("\x1b[38;2;107;155;250m");
  expect(ansi.chrome).toBe("\x1b[38;2;53;116;240m");
  expect(ansi.ok).toBe("\x1b[38;2;73;156;84m");
  expect(ansi.warn).toBe("\x1b[38;2;201;165;78m");
  expect(ansi.danger).toBe("\x1b[38;2;224;87;101m");
});
