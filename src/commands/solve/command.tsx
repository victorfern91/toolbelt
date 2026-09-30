import { useEffect, useState } from "react";
import { Text, useInput } from "ink";
import { Busy, Done, Fail, Hints, Screen } from "../../ui/screen.tsx";
import { isQuit, leaveHintKeys, useNav } from "../../ui/nav.ts";
import { color } from "../../ui/theme.ts";
import { registerTool } from "../registry.ts";
import { errMsg } from "../../utils/errors.ts";
import { runSolveHost, startSolveHost } from "./host.ts";

type Outcome = { kind: "applied" } | { kind: "abandoned" };

function SolveView() {
  const { back, quit, nested } = useNav();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let gone = false;
    void (async () => {
      const r = await startSolveHost({ open: true });
      if (gone) {
        if (r.isOk()) r.value.stop();
        return;
      }
      if (r.isErr()) {
        setError(errMsg(r.error));
        return;
      }
      stop = r.value.stop;
      setUrl(r.value.url);
      const next = await r.value.done;
      if (gone) return;
      setOutcome({ kind: next });
      r.value.stop();
    })();
    return () => {
      gone = true;
      stop?.();
    };
  }, []);

  useInput((input, key) => {
    if (isQuit(input, key)) {
      quit();
      return;
    }
    if (outcome || error) return back();
  });

  if (error) return <Fail>{error}</Fail>;
  if (outcome?.kind === "abandoned") {
    return (
      <Done>
        <Text>
          <Text color={color.warn}>• </Text>
          remaining conflicts left in the worktree
        </Text>
      </Done>
    );
  }
  if (outcome?.kind === "applied") {
    return (
      <Done>
        <Text>
          <Text color={color.ok}>✓ </Text>
          conflicts applied and staged — continue the merge/rebase
        </Text>
      </Done>
    );
  }
  if (!url) return <Busy>Starting solve host…</Busy>;

  return (
    <Screen
      badge="solve"
      subtitle={<Text dimColor> resolve conflicts in the browser</Text>}
      footer={<Hints keys={leaveHintKeys(nested)} />}
    >
      <Text>
        UI <Text color={color.accent}>{url}</Text>
      </Text>
      <Text dimColor>waiting for apply (close tab = leave remaining)…</Text>
    </Screen>
  );
}

export function Solve() {
  return <SolveView />;
}

registerTool({
  name: "solve",
  desc: "3-pane merge/rebase conflict UI (WebStorm-style)",
  ui: () => <Solve />,
  flags: {
    "--host": { desc: "open the conflict UI and wait until apply or tab close", run: runSolveHost },
  },
});
