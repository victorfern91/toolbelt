import { expect, test } from "bun:test";
import { chmodSync, lstatSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureTbSymlink, installTarget } from "./update.ts";

const dir = () => mkdtempSync(join(tmpdir(), "tb-link-"));

test("creates tb → toolbelt next to the binary", () => {
  const root = dir();
  try {
    const toolbelt = join(root, "toolbelt");
    writeFileSync(toolbelt, "x");
    chmodSync(toolbelt, 0o755);
    expect(ensureTbSymlink(toolbelt)).toBe(true);
    expect(lstatSync(join(root, "tb")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(root, "tb"))).toBe("toolbelt");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("is a no-op when tb already points at toolbelt", () => {
  const root = dir();
  try {
    const toolbelt = join(root, "toolbelt");
    writeFileSync(toolbelt, "x");
    expect(ensureTbSymlink(toolbelt)).toBe(true);
    expect(ensureTbSymlink(toolbelt)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not clobber a real tb file", () => {
  const root = dir();
  try {
    const toolbelt = join(root, "toolbelt");
    writeFileSync(toolbelt, "x");
    writeFileSync(join(root, "tb"), "someone else's tb");
    expect(ensureTbSymlink(toolbelt)).toBe(false);
    expect(lstatSync(join(root, "tb")).isSymbolicLink()).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("links tb next to toolbelt even when invoked as tb", () => {
  const root = dir();
  try {
    const toolbelt = join(root, "toolbelt");
    writeFileSync(toolbelt, "x");
    expect(ensureTbSymlink(installTarget(join(root, "tb")))).toBe(true);
    expect(readlinkSync(join(root, "tb"))).toBe("toolbelt");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
