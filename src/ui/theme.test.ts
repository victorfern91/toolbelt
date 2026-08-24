import { expect, test } from "bun:test";
import { ansi, color } from "./theme.ts";

test("ansi codes are truecolor Nord", () => {
  expect(color.accent).toBe("#88C0D0");
  expect(ansi.accent).toBe("\x1b[38;2;136;192;208m");
  expect(ansi.chrome).toBe("\x1b[38;2;180;142;173m");
  expect(ansi.ok).toBe("\x1b[38;2;163;190;140m");
  expect(ansi.warn).toBe("\x1b[38;2;235;203;139m");
  expect(ansi.danger).toBe("\x1b[38;2;191;97;106m");
});
