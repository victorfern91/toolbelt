import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { VERSION } from "../update.ts";
import { color } from "./theme.ts";

/** Renders above the TUI once a parallel `checkForUpdate()` resolves to a newer tag. */
export function UpdateBanner({ check }: { check: Promise<string | null> }) {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    check.then((tag) => {
      if (alive) setLatest(tag);
    });
    return () => {
      alive = false;
    };
  }, [check]);

  if (!latest) return null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color.warn}>
        {`🚀 toolbelt ${latest} is available  (you have ${VERSION})`}
      </Text>
      <Text color={color.warn}>
        run{" "}
        <Text bold color={color.accent}>
          toolbelt upgrade
        </Text>{" "}
        to update
      </Text>
    </Box>
  );
}
