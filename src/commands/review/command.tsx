import { useEffect, useState } from "react";
import { Text, useInput } from "ink";
import { Busy, Done, Fail, Hints, Screen } from "../../ui/screen.tsx";
import { isQuit, leaveHintKeys, useNav } from "../../ui/nav.ts";
import { color } from "../../ui/theme.ts";
import { registerTool } from "../registry.ts";
import { errMsg } from "../../utils/errors.ts";
import { runReviewHost, startReviewHost } from "./host.ts";

function ReviewView() {
  const { back, quit, nested } = useNav();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let gone = false;
    void (async () => {
      const r = await startReviewHost({ open: true });
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
      setPrompt(next);
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
    if (prompt || error) return back();
  });

  if (error) return <Fail>{error}</Fail>;
  if (prompt) {
    return (
      <Done>
        <Text>
          <Text color={color.ok}>✓ </Text>
          feedback submitted — prompt printed for the agent
        </Text>
      </Done>
    );
  }
  if (!url) return <Busy>Starting review host…</Busy>;

  return (
    <Screen
      badge="review"
      subtitle={<Text dimColor> annotate in the browser, then submit</Text>}
      footer={<Hints keys={leaveHintKeys(nested)} />}
    >
      <Text>
        UI <Text color={color.accent}>{url}</Text>
      </Text>
      <Text dimColor>waiting for submit…</Text>
    </Screen>
  );
}

export function Review() {
  return <ReviewView />;
}

registerTool({
  name: "review",
  desc: "host a local diff review UI, then emit an agent prompt",
  ui: () => <Review />,
  flags: {
    "--host": { desc: "open the review UI and print the prompt on submit", run: runReviewHost },
  },
});
