import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { color } from "./theme.ts";

export function Screen({
  badge,
  subtitle,
  children,
  footer,
}: {
  badge: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text backgroundColor={color.chrome} color={color.onChrome} bold>
          {` ${badge} `}
        </Text>
        {subtitle}
      </Box>
      {children != null ? (
        <Box flexDirection="column" marginTop={1}>
          {children}
        </Box>
      ) : null}
      {footer != null ? <Box marginTop={1}>{footer}</Box> : null}
    </Box>
  );
}

export function Caret({ on }: { on: boolean }) {
  return <Text color={on ? color.chrome : undefined}>{on ? "❯ " : "  "}</Text>;
}

export function MenuRow({
  on,
  label,
  desc,
  width,
}: {
  on: boolean;
  label: string;
  desc: string;
  width: number;
}) {
  return (
    <Text>
      <Caret on={on} />
      <Text bold={on} color={color.accent}>
        {label.padEnd(width)}
      </Text>
      <Text dimColor>{desc}</Text>
    </Text>
  );
}

export function Hints({ keys }: { keys: ReadonlyArray<readonly [string, string]> }) {
  return (
    <Text dimColor>
      {keys.map(([key, label], i) => (
        <Text key={key}>
          {i > 0 ? " · " : null}
          <Text color={color.chrome}>{key}</Text> {label}
        </Text>
      ))}
    </Text>
  );
}

export function Page({
  offset,
  size,
  total,
  children,
}: {
  offset: number;
  size: number;
  total: number;
  children: ReactNode;
}) {
  const below = total - offset - size;
  return (
    <>
      {offset > 0 ? <Text dimColor> ↑ {offset} more</Text> : null}
      {children}
      {below > 0 ? <Text dimColor> ↓ {below} more</Text> : null}
    </>
  );
}

export function Busy({ children }: { children: ReactNode }) {
  return <Text color={color.accent}>{children}</Text>;
}

export function Fail({ children }: { children: ReactNode }) {
  return <Text color={color.danger}>✗ {children}</Text>;
}

export function Mark({ ok }: { ok: boolean }) {
  return ok ? <Text color={color.ok}>✓ </Text> : <Text color={color.danger}>✗ </Text>;
}

export function Done({ children }: { children: ReactNode }) {
  return (
    <Box flexDirection="column">
      {children}
      <Text dimColor>press any key to exit</Text>
    </Box>
  );
}
