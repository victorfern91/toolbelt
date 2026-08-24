import { createContext, createElement, useContext, type ReactNode } from "react";
import { useApp } from "ink";

export type Nav = {
  /** Pop to the previous screen, or quit if this is the root. */
  back: () => void;
  /** Always leave the app. */
  quit: () => void;
  nested: boolean;
};

const NavContext = createContext<Nav | null>(null);

export function NavProvider({
  back,
  quit,
  children,
}: {
  back: () => void;
  quit: () => void;
  children: ReactNode;
}) {
  return createElement(NavContext.Provider, { value: { back, quit, nested: true } }, children);
}

export function useNav(): Nav {
  const { exit } = useApp();
  return useContext(NavContext) ?? { back: exit, quit: exit, nested: false };
}

export function isQuit(input: string, key: { ctrl: boolean }): boolean {
  return input === "q" || (key.ctrl && input === "c");
}

export function leaveHintKeys(nested: boolean): ReadonlyArray<readonly [string, string]> {
  return nested
    ? [
        ["esc", "back"],
        ["q", "quit"],
      ]
    : [["q", "quit"]];
}
