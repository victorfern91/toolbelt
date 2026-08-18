import type { ReactNode } from "react";
import type { AsyncResult } from "@attio/fetchable";

export type ToolFlag = { desc: string; run: () => AsyncResult<void, unknown> };

export type Tool = {
  name: string;
  desc: string;
  ui: () => ReactNode;
  flags?: Record<string, ToolFlag>;
};

// Tools self-register at import time (see src/commands/index.ts). The menu,
// --help output, and dispatch in cli.tsx all read from here, so registering
// is the only wiring a new tool needs.
const registry = new Map<string, Tool>();

export function registerTool(tool: Tool) {
  if (registry.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
  registry.set(tool.name, tool);
}

export const tools = () => [...registry.values()];
export const findTool = (name: string) => registry.get(name);
