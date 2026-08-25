import { afterEach, expect, test } from "bun:test";
import { chmodSync, lstatSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok } from "neverthrow";
import { checkForUpdate, ensureTbSymlink, installTarget, runFullUpdate } from "./update.ts";

const dir = () => mkdtempSync(join(tmpdir(), "tb-link-"));

const prevFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = prevFetch;
});

const mockRelease = (tag: string) => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ tag_name: tag, assets: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
};

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

test("checkForUpdate returns the newer tag from GitHub", async () => {
  mockRelease("v0.1.9");
  expect(await checkForUpdate("0.1.7")).toBe("v0.1.9");
});

test("checkForUpdate returns null when already current", async () => {
  mockRelease("v0.1.9");
  expect(await checkForUpdate("0.1.9")).toBeNull();
});

test("checkForUpdate returns null when the request fails", async () => {
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  expect(await checkForUpdate("0.1.0")).toBeNull();
});

test("runFullUpdate always refreshes the AI stack after the binary step", async () => {
  const order: string[] = [];
  const { bin, ai } = await runFullUpdate(
    async () => {
      order.push("bin");
      return 0;
    },
    async () => {
      order.push("ai");
      return ok(undefined);
    },
  );
  expect(order).toEqual(["bin", "ai"]);
  expect(bin).toBe(0);
  expect(ai.isOk()).toBe(true);
});

test("runFullUpdate still refreshes AI when the binary update fails", async () => {
  let aiRan = false;
  const { bin, ai } = await runFullUpdate(
    async () => 1,
    async () => {
      aiRan = true;
      return ok(undefined);
    },
  );
  expect(aiRan).toBe(true);
  expect(bin).toBe(1);
  expect(ai.isOk()).toBe(true);
});

test("runFullUpdate surfaces an AI stack failure", async () => {
  const { bin, ai } = await runFullUpdate(
    async () => 0,
    async () => err(new Error("grill-me missing")),
  );
  expect(bin).toBe(0);
  expect(ai.isErr()).toBe(true);
});
