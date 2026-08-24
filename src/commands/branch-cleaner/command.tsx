import { useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import {
  deleteBranch,
  listBranches,
  loadBranches,
  type Branch,
} from "../../capabilities/git/index.ts";
import { Busy, Caret, Done, Fail, Hints, Page, Screen } from "../../ui/screen.tsx";
import { isQuit, leaveHintKeys, useNav } from "../../ui/nav.ts";
import { color } from "../../ui/theme.ts";
import { registerTool } from "../registry.ts";
import { errMsg } from "../../utils/errors.ts";
import {
  BranchCleanerProvider,
  useBranchCleanerState,
  type Result as DeleteResult,
} from "./store.ts";

const PAGE = 12;

const tag = (b: Branch) =>
  b.current
    ? { label: "current", color: color.accent }
    : b.gone
      ? { label: "gone", color: color.danger }
      : b.merged
        ? { label: "merged", color: color.ok }
        : { label: "active", color: color.warn };

function BranchCleanerView() {
  const { back, quit, nested } = useNav();
  const { state, dispatch } = useBranchCleanerState();
  const { base, branches, error, loading, cursor, picked, force, confirming, results } = state;

  useEffect(() => {
    void (async () => {
      const res = await loadBranches();
      if (res.isErr()) return dispatch({ type: "failed", error: errMsg(res.error) });
      dispatch({ type: "loaded", base: res.value.base, branches: res.value.branches });
    })();
  }, []);

  const view = useMemo(() => {
    const start = Math.max(0, Math.min(cursor - (PAGE >> 1), branches.length - PAGE));
    return {
      start: Math.max(0, start),
      rows: branches.slice(Math.max(0, start), Math.max(0, start) + PAGE),
    };
  }, [branches, cursor]);

  const runDelete = async () => {
    const names = branches.filter((b) => picked.has(b.name)).map((b) => b.name);
    const out: DeleteResult[] = [];
    for (const name of names) {
      const r = await ResultAsync.fromPromise(deleteBranch(name, force), (e) => e);
      out.push({
        name,
        ok: r.isOk() && r.value.code === 0,
        err: r.isOk() ? (r.value.err.split("\n")[0] ?? "") : errMsg(r.error),
      });
    }
    const refreshed = await listBranches(base);
    dispatch({ type: "deleted", results: out, branches: refreshed.unwrapOr(branches) });
  };

  useInput((input, key) => {
    if (results) {
      if (isQuit(input, key)) return quit();
      return back();
    }
    if (confirming) {
      if (input === "y") void runDelete();
      if (input === "n" || key.escape) dispatch({ type: "cancel" });
      return;
    }
    if (isQuit(input, key)) return quit();
    if (key.escape) return back();
    if (key.downArrow || input === "j") dispatch({ type: "move", delta: 1 });
    if (key.upArrow || input === "k") dispatch({ type: "move", delta: -1 });
    if (input === " ") {
      const b = branches[cursor];
      if (b && !b.current) dispatch({ type: "toggle", name: b.name });
    }
    if (input === "a") dispatch({ type: "pick-safe" });
    if (input === "f") dispatch({ type: "toggle-force" });
    if (key.return) dispatch({ type: "confirm" });
  });

  if (loading) return <Busy>Reading branches…</Busy>;
  if (error) return <Fail>{error}</Fail>;

  if (results) {
    const failed = results.filter((r) => !r.ok);
    return (
      <Done>
        {results.map((r) => (
          <Text key={r.name}>
            {r.ok ? (
              <Text color={color.ok}>✓ deleted </Text>
            ) : (
              <Text color={color.danger}>✗ kept </Text>
            )}
            <Text bold>{r.name}</Text>
            {r.err ? <Text dimColor> — {r.err}</Text> : null}
          </Text>
        ))}
        {failed.length > 0 ? (
          <Text dimColor>press f then enter next time to force-delete unmerged branches</Text>
        ) : null}
      </Done>
    );
  }

  return (
    <Screen
      badge="branch-cleaner"
      subtitle={
        <>
          <Text dimColor>
            {" "}
            base <Text color={color.accent}>{base}</Text> · {branches.length} branches ·{" "}
            {picked.size} selected{force ? " · " : ""}
          </Text>
          {force ? (
            <Text color={color.danger} bold>
              FORCE
            </Text>
          ) : null}
        </>
      }
      footer={
        confirming ? (
          <Text color={color.warn} bold>
            Delete {picked.size} branch{picked.size === 1 ? "" : "es"}
            {force ? " (FORCE, unmerged work is lost)" : ""}? y/n
          </Text>
        ) : (
          <Hints
            keys={[
              ["↑↓/jk", "move"],
              ["space", "pick"],
              ["a", "all safe"],
              ["f", "force"],
              ["enter", "delete"],
              ...leaveHintKeys(nested),
            ]}
          />
        )
      }
    >
      <Page offset={view.start} size={PAGE} total={branches.length}>
        {view.rows.map((b, i) => {
          const idx = view.start + i;
          const on = idx === cursor;
          const t = tag(b);
          return (
            <Box key={b.name}>
              <Caret on={on} />
              <Text color={picked.has(b.name) ? color.danger : undefined}>
                {picked.has(b.name) ? "◉ " : b.current ? "· " : "◯ "}
              </Text>
              <Text bold={on} color={b.current ? color.accent : undefined}>
                {b.name.padEnd(34).slice(0, 34)}
              </Text>
              <Text color={t.color}> {t.label.padEnd(8)}</Text>
              <Text dimColor>
                {b.ahead ? `↑${b.ahead} ` : ""}
                {b.behind ? `↓${b.behind} ` : ""}
                {b.date}
              </Text>
            </Box>
          );
        })}
      </Page>
    </Screen>
  );
}

export function BranchCleaner() {
  return (
    <BranchCleanerProvider>
      <BranchCleanerView />
    </BranchCleanerProvider>
  );
}

export const printBranches = async (): Promise<Result<void, unknown>> => {
  const res = await loadBranches();
  if (res.isErr()) return err(res.error);
  for (const b of res.value.branches) {
    const state = b.current ? "current" : b.gone ? "gone" : b.merged ? "merged" : "active";
    console.log(`${state.padEnd(8)} ${b.name.padEnd(40)} ${b.date}`);
  }
  return ok(undefined);
};

registerTool({
  name: "branch-cleaner",
  desc: "review and delete stale local git branches",
  ui: () => <BranchCleaner />,
  flags: { "--list": { desc: "print branches, no UI", run: printBranches } },
});
