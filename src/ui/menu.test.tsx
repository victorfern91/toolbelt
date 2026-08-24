import { expect, test } from "bun:test";
import { Text, useInput } from "ink";
import { render } from "ink-testing-library";
import type { Tool } from "../commands/registry.ts";
import { Menu } from "./menu.tsx";
import { useNav } from "./nav.ts";

function Child() {
  const { back } = useNav();
  useInput((_, key) => {
    if (key.escape) back();
  });
  return <Text>inside-tool</Text>;
}

const items: Tool[] = [{ name: "fake", desc: "a fake tool", ui: () => <Child /> }];

test("escape from a tool returns to the menu", async () => {
  const { lastFrame, stdin, unmount } = render(<Menu items={items} />);
  expect(lastFrame() ?? "").toContain("fake");
  stdin.write("\r");
  await Bun.sleep(50);
  expect(lastFrame() ?? "").toContain("inside-tool");
  stdin.write("\x1b");
  await Bun.sleep(50);
  expect(lastFrame() ?? "").toContain("fake");
  expect(lastFrame() ?? "").not.toContain("inside-tool");
  unmount();
});
