import { useEffect, useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import {
  assertRepo,
  defaultBranch,
  deleteBranch,
  listBranches,
  type Branch,
} from "../../capabilities/git/index.ts";
import { registerTool } from "../registry.ts";
import {
  BranchCleanerProvider,
  useBranchCleanerState,
  type Result,
} from "./store.ts";

const PAGE = 12;

const tag = (b: Branch) =>
  b.current
    ? { label: "current", color: "cyan" as const }
    : b.gone
      ? { label: "gone", color: "red" as const }
      : b.merged
        ? { label: "merged", color: "green" as const }
        : { label: "active", color: "yellow" as const };

function BranchCleanerView() {
  const { exit } = useApp();
  const { state, dispatch } = useBranchCleanerState();
  const { base, branches, error, loading, cursor, picked, force, confirming, results } = state;

  useEffect(() => {
    (async () => {
      try {
        await assertRepo();
        const b = await defaultBranch();
        dispatch({ type: "loaded", base: b, branches: await listBranches(b) });
      } catch (e) {
        dispatch({ type: "failed", error: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, []);

  const view = useMemo(() => {
    const start = Math.max(0, Math.min(cursor - (PAGE >> 1), branches.length - PAGE));
    return { start: Math.max(0, start), rows: branches.slice(Math.max(0, start), Math.max(0, start) + PAGE) };
  }, [branches, cursor]);

  const runDelete = async () => {
    const names = branches.filter((b) => picked.has(b.name)).map((b) => b.name);
    const out: Result[] = [];
    for (const name of names) {
      const r = await deleteBranch(name, force);
      out.push({ name, ok: r.code === 0, err: r.err.split("\n")[0] ?? "" });
    }
    dispatch({ type: "deleted", results: out, branches: await listBranches(base) });
  };

  useInput((input, key) => {
    if (results) {
      exit();
      return;
    }
    if (confirming) {
      if (input === "y") void runDelete();
      if (input === "n" || key.escape) dispatch({ type: "cancel" });
      return;
    }
    if (input === "q" || key.escape || (key.ctrl && input === "c")) return exit();
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

  if (loading) return <Text color="cyan">Reading branches…</Text>;
  if (error) return <Text color="red">✗ {error}</Text>;

  if (results) {
    const failed = results.filter((r) => !r.ok);
    return (
      <Box flexDirection="column">
        {results.map((r) => (
          <Text key={r.name}>
            {r.ok ? <Text color="green">✓ deleted </Text> : <Text color="red">✗ kept </Text>}
            <Text bold>{r.name}</Text>
            {r.err ? <Text dimColor> — {r.err}</Text> : null}
          </Text>
        ))}
        {failed.length > 0 ? (
          <Text dimColor>press f then enter next time to force-delete unmerged branches</Text>
        ) : null}
        <Text dimColor>press any key to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text backgroundColor="magenta" color="black" bold>
          {" branch-cleaner "}
        </Text>
        <Text dimColor>
          {" "}
          base <Text color="cyan">{base}</Text> · {branches.length} branches ·{" "}
          {picked.size} selected{force ? " · " : ""}
        </Text>
        {force ? <Text color="red" bold>FORCE</Text> : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {view.start > 0 ? <Text dimColor>  ↑ {view.start} more</Text> : null}
        {view.rows.map((b, i) => {
          const idx = view.start + i;
          const on = idx === cursor;
          const t = tag(b);
          return (
            <Box key={b.name}>
              <Text color={on ? "magenta" : undefined}>{on ? "❯ " : "  "}</Text>
              <Text color={picked.has(b.name) ? "red" : undefined}>
                {picked.has(b.name) ? "◉ " : b.current ? "· " : "◯ "}
              </Text>
              <Text bold={on} color={b.current ? "cyan" : undefined}>
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
        {view.start + PAGE < branches.length ? (
          <Text dimColor>  ↓ {branches.length - view.start - PAGE} more</Text>
        ) : null}
      </Box>

      <Box marginTop={1}>
        {confirming ? (
          <Text color="yellow" bold>
            Delete {picked.size} branch{picked.size === 1 ? "" : "es"}
            {force ? " (FORCE, unmerged work is lost)" : ""}? y/n
          </Text>
        ) : (
          <Text dimColor>
            <Text color="magenta">↑↓/jk</Text> move · <Text color="magenta">space</Text> pick ·{" "}
            <Text color="magenta">a</Text> all safe · <Text color="magenta">f</Text> force ·{" "}
            <Text color="magenta">enter</Text> delete · <Text color="magenta">q</Text> quit
          </Text>
        )}
      </Box>
    </Box>
  );
}

export function BranchCleaner() {
  return (
    <BranchCleanerProvider>
      <BranchCleanerView />
    </BranchCleanerProvider>
  );
}

export async function printBranches() {
  await assertRepo();
  const base = await defaultBranch();
  for (const b of await listBranches(base)) {
    const state = b.current ? "current" : b.gone ? "gone" : b.merged ? "merged" : "active";
    console.log(`${state.padEnd(8)} ${b.name.padEnd(40)} ${b.date}`);
  }
}

registerTool({
  name: "branch-cleaner",
  desc: "review and delete stale local git branches",
  ui: () => <BranchCleaner />,
  flags: { "--list": { desc: "print branches, no UI", run: printBranches } },
});
