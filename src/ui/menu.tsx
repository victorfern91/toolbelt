import { useState } from "react";
import { useApp, useInput } from "ink";
import { tools, type Tool } from "../commands/registry.ts";
import { NavProvider } from "./nav.ts";
import { Hints, MenuRow, Screen } from "./screen.tsx";

export function Menu({ items = tools() }: { items?: Tool[] }) {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);

  useInput((input, key) => {
    if (chosen !== null) return;
    if (input === "q" || key.escape) return exit();
    if (key.downArrow || input === "j") setCursor((c) => (c + 1) % items.length);
    if (key.upArrow || input === "k") setCursor((c) => (c - 1 + items.length) % items.length);
    if (key.return) setChosen(cursor);
  });

  if (chosen !== null) {
    return (
      <NavProvider back={() => setChosen(null)} quit={exit}>
        {items[chosen]!.ui()}
      </NavProvider>
    );
  }

  return (
    <Screen
      badge="toolbelt"
      footer={
        <Hints
          keys={[
            ["↑↓", "move"],
            ["enter", "run"],
            ["q", "quit"],
          ]}
        />
      }
    >
      {items.map((t, i) => (
        <MenuRow key={t.name} on={i === cursor} label={t.name} desc={t.desc} width={20} />
      ))}
    </Screen>
  );
}
