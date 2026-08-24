import { expect, test } from "bun:test";
import { resolveBranch } from "./index.ts";

const names = ["main", "feat/login", "feat/logout", "wip"];

test("exact match", () => {
  expect(resolveBranch("main", names)).toBe("main");
  expect(resolveBranch("-", names)).toBe("-");
});

test("unique prefix", () => {
  expect(resolveBranch("w", names)).toBe("wip");
  expect(resolveBranch("feat/logi", names)).toBe("feat/login");
});

test("unique substring", () => {
  expect(resolveBranch("login", names)).toBe("feat/login");
});

test("ambiguous prefix", () => {
  const r = resolveBranch("feat/", names);
  expect(r).toBeInstanceOf(Error);
  expect((r as Error).message).toContain("ambiguous");
});

test("no match", () => {
  const r = resolveBranch("nope", names);
  expect(r).toBeInstanceOf(Error);
  expect((r as Error).message).toContain("no local branch");
});
