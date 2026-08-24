import { useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { err, ok, type Result } from "neverthrow";
import {
  loadBranches,
  resolveBranch,
  switchBranch,
  type Branch,
} from "../../capabilities/git/index.ts";
import { Busy, Caret, Fail, Hints, Page, Screen } from "../../ui/screen.tsx";
import { isQuit, leaveHintKeys, useNav } from "../../ui/nav.ts";
import { color } from "../../ui/theme.ts";
import { registerTool } from "../registry.ts";
import { errMsg } from "../../utils/errors.ts";
import { SwitchProvider, useSwitchState } from "./store.ts";

const PAGE = 12;

async function checkoutResolved(
  name: string,
  branches: Branch[],
): Promise<Result<string, unknown>> {
  const current = branches.find((b) => b.current)?.name;
  if (name !== "-" && name === current) return ok(name);
  const r = await switchBranch(name);
  if (r.isErr()) return err(r.error);
  return ok(name);
}

function SwitchView() {
  const { back, quit, nested } = useNav();
  const { state, dispatch } = useSwitchState();
  const { branches, error, loading, cursor, status } = state;

  useEffect(() => {
    void (async () => {
      const res = await loadBranches({ prune: false });
      if (res.isErr()) return dispatch({ type: "failed", error: errMsg(res.error) });
      dispatch({ type: "loaded", branches: res.value.branches });
    })();
  }, []);

  const view = useMemo(() => {
    const start = Math.max(0, Math.min(cursor - (PAGE >> 1), branches.length - PAGE));
    return {
      start: Math.max(0, start),
      rows: branches.slice(Math.max(0, start), Math.max(0, start) + PAGE),
    };
  }, [branches, cursor]);

  const runSwitch = async (name: string) => {
    const r = await checkoutResolved(name, branches);
    if (r.isErr()) return dispatch({ type: "status", status: `✗ ${errMsg(r.error)}` });
    const already = name === branches.find((b) => b.current)?.name;
    console.log(already ? `already on ${r.value}` : `✓ ${r.value}`);
    quit();
  };

  useInput((input, key) => {
    if (error) {
      if (isQuit(input, key)) return quit();
      return back();
    }
    if (isQuit(input, key)) return quit();
    if (key.escape) return back();
    if (key.downArrow || input === "j") dispatch({ type: "move", delta: 1 });
    if (key.upArrow || input === "k") dispatch({ type: "move", delta: -1 });
    if (key.return) {
      const b = branches[cursor];
      if (b) void runSwitch(b.name);
    }
  });

  if (loading) return <Busy>Reading branches…</Busy>;
  if (error) return <Fail>{error}</Fail>;

  return (
    <Screen
      badge="switch"
      subtitle={<Text dimColor> {branches.length} local</Text>}
      footer={
        status ? (
          <Text color={color.danger}>{status}</Text>
        ) : (
          <Hints keys={[["↑↓/jk", "move"], ["enter", "switch"], ...leaveHintKeys(nested)]} />
        )
      }
    >
      <Page offset={view.start} size={PAGE} total={branches.length}>
        {view.rows.map((b, i) => {
          const idx = view.start + i;
          const on = idx === cursor;
          return (
            <Box key={b.name}>
              <Caret on={on} />
              <Text color={b.current ? color.accent : undefined}>{b.current ? "· " : "  "}</Text>
              <Text bold={on} color={b.current ? color.accent : undefined}>
                {b.name.padEnd(40).slice(0, 40)}
              </Text>
              <Text dimColor>
                {b.date} {b.subject.slice(0, 40)}
              </Text>
            </Box>
          );
        })}
      </Page>
    </Screen>
  );
}

export function Switch() {
  return (
    <SwitchProvider>
      <SwitchView />
    </SwitchProvider>
  );
}

export const checkoutArg = async (rest: string[]): Promise<Result<void, unknown>> => {
  const query = rest[0] ?? "";
  const res = await loadBranches({ prune: false });
  if (res.isErr()) return err(res.error);
  const names = res.value.branches.map((b) => b.name);
  const resolved = resolveBranch(query, names);
  if (resolved instanceof Error) return err(resolved);
  const r = await checkoutResolved(resolved, res.value.branches);
  if (r.isErr()) return err(r.error);
  const already = res.value.branches.find((b) => b.current)?.name === r.value;
  console.log(already ? `already on ${r.value}` : `✓ ${r.value}`);
  return ok(undefined);
};

registerTool({
  name: "switch",
  desc: "checkout a local git branch",
  ui: () => <Switch />,
  args: { usage: "[branch]", desc: "checkout by name (prefix ok)", run: checkoutArg },
});
