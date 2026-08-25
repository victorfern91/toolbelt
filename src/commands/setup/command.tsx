import { useState } from "react";
import { Text, useInput } from "ink";
import { printSetupAi, setupAi, type Step } from "../../capabilities/ai-setup/index.ts";
import { Busy, Done, Fail, Hints, Mark, MenuRow, Screen } from "../../ui/screen.tsx";
import { isQuit, leaveHintKeys, useNav } from "../../ui/nav.ts";
import { registerTool } from "../registry.ts";
import { errMsg } from "../../utils/errors.ts";

const RECIPES = [
  { name: "ai", desc: "rtk, caveman, grill-me, toolbelt skill + global Claude/Cursor rules" },
] as const;

function SetupView() {
  const { back, quit, nested } = useNav();
  const [cursor, setCursor] = useState(0);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setRunning(true);
    const r = await setupAi();
    if (r.isErr()) {
      setError(errMsg(r.error));
      setRunning(false);
      return;
    }
    setSteps(r.value);
    setRunning(false);
  };

  useInput((input, key) => {
    if (running) return;
    if (steps || error) {
      if (isQuit(input, key)) return quit();
      return back();
    }
    if (isQuit(input, key)) return quit();
    if (key.escape) return back();
    if (key.downArrow || input === "j") setCursor((c) => (c + 1) % RECIPES.length);
    if (key.upArrow || input === "k") setCursor((c) => (c - 1 + RECIPES.length) % RECIPES.length);
    if (key.return) void run();
  });

  if (error) return <Fail>{error}</Fail>;
  if (running) return <Busy>Running {RECIPES[cursor]!.name} setup…</Busy>;
  if (steps) {
    return (
      <Done>
        {steps.map((s) => (
          <Text key={s.name}>
            <Mark ok={s.ok} />
            <Text bold>{s.name.padEnd(10)}</Text>
            <Text dimColor>{s.detail}</Text>
          </Text>
        ))}
      </Done>
    );
  }

  return (
    <Screen
      badge="setup"
      subtitle={<Text dimColor> machine-wide installs</Text>}
      footer={<Hints keys={[["↑↓/jk", "move"], ["enter", "run"], ...leaveHintKeys(nested)]} />}
    >
      {RECIPES.map((r, i) => (
        <MenuRow key={r.name} on={i === cursor} label={r.name} desc={r.desc} width={8} />
      ))}
    </Screen>
  );
}

export function Setup() {
  return <SetupView />;
}

registerTool({
  name: "setup",
  desc: "machine-wide installs (ai, …)",
  ui: () => <Setup />,
  flags: {
    ai: {
      desc: "rtk, caveman, grill-me, toolbelt skill + global Claude/Cursor rules",
      run: printSetupAi,
    },
  },
});
