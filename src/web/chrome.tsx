import type { ReactNode, ButtonHTMLAttributes, CSSProperties, TextareaHTMLAttributes } from "react";
import * as stylex from "@stylexjs/stylex";
import { tokens } from "./tokens.stylex.ts";

const styles = stylex.create({
  root: {
    height: "100%",
    display: "grid",
    backgroundColor: tokens.bg,
    color: tokens.text,
    fontSize: 13,
    lineHeight: 1.45,
  },
  review: {
    gridTemplateRows: "auto minmax(0, 1fr) auto",
  },
  solve: {
    gridTemplateRows: "auto auto minmax(0, 1fr) auto",
  },
  top: {
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
    paddingBlock: "0.55rem",
    paddingInline: "0.9rem",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.border,
    backgroundColor: tokens.bg2,
  },
  badge: {
    backgroundColor: tokens.accent,
    color: "#fff",
    fontWeight: 700,
    paddingBlock: "0.1rem",
    paddingInline: "0.45rem",
    borderRadius: 3,
    letterSpacing: "0.02em",
  },
  meta: {
    color: tokens.muted,
    flexGrow: 1,
    minWidth: 0,
  },
  title: {
    color: tokens.text,
    fontWeight: 600,
  },
  titlePath: {
    fontFamily: tokens.fontMono,
    fontWeight: 500,
    color: tokens.accent2,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    paddingBlock: "0.4rem",
    paddingInline: "0.9rem",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.border,
    backgroundColor: tokens.bg2,
    fontSize: 12,
  },
  status: {
    marginLeft: "auto",
    color: tokens.warn,
    fontVariantNumeric: "tabular-nums",
  },
  body: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  bodyWithSidebar: {
    gridTemplateColumns: "260px minmax(0, 1fr)",
  },
  sidebar: {
    minHeight: 0,
    overflow: "auto",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: tokens.border,
    backgroundColor: tokens.bg2,
    display: "flex",
    flexDirection: "column",
  },
  main: {
    minWidth: 0,
    minHeight: 0,
    position: "relative",
  },
  fill: {
    position: "absolute",
    inset: 0,
    overflow: "auto",
  },
  footer: {
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: tokens.border,
    paddingBlock: "0.55rem",
    paddingInline: "0.9rem",
    backgroundColor: tokens.bg2,
  },
  footerSplit: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.75rem",
  },
  footerStack: {
    display: "grid",
    gap: "0.45rem",
  },
  btn: {
    font: "inherit",
    color: tokens.text,
    backgroundColor: tokens.bg3,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.border,
    borderRadius: 4,
    paddingBlock: "0.3rem",
    paddingInline: "0.7rem",
    cursor: "pointer",
  },
  btnHover: {
    ":hover": {
      borderColor: tokens.accent2,
    },
  },
  btnDisabled: {
    ":disabled": {
      opacity: 0.45,
      cursor: "default",
    },
  },
  primary: {
    backgroundColor: tokens.accent,
    color: "#fff",
    borderColor: tokens.accent,
    fontWeight: 600,
  },
  ok: { color: tokens.ok },
  danger: { color: tokens.danger },
  okActive: {
    backgroundColor: "color-mix(in oklab, #499c54 22%, #2b2d30)",
    borderColor: tokens.ok,
  },
  dangerActive: {
    backgroundColor: "color-mix(in oklab, #e05765 22%, #2b2d30)",
    borderColor: tokens.danger,
  },
  chev: {
    width: 28,
    height: 22,
    padding: 0,
    fontSize: 14,
    lineHeight: 1,
    borderRadius: 3,
    backgroundColor: tokens.bg3,
    color: tokens.text,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.accent2,
    cursor: "pointer",
  },
  chevTake: { color: tokens.accent2 },
  chevReject: { color: tokens.danger },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    userSelect: "none",
    color: tokens.muted,
  },
  msg: {
    padding: "1.5rem",
    color: tokens.muted,
  },
  row: {
    display: "flex",
    gap: "0.45rem",
    alignItems: "center",
  },
  textarea: {
    width: "100%",
    minHeight: "4.5rem",
    resize: "vertical",
    backgroundColor: tokens.bg,
    color: "inherit",
    font: "inherit",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.border,
    borderRadius: 6,
    paddingBlock: "0.45rem",
    paddingInline: "0.55rem",
  },
  note: {
    marginTop: "0.35rem",
    marginBottom: "0.7rem",
    marginInline: "0.5rem",
    paddingBlock: "0.5rem",
    paddingInline: "0.65rem",
    backgroundColor: tokens.bg2,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.border,
    borderLeftWidth: 3,
    borderLeftColor: tokens.accent,
    borderRadius: 6,
  },
  noteHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.5rem",
    color: tokens.muted,
    fontSize: 12,
  },
  noteBody: {
    marginTop: "0.25rem",
    marginBottom: 0,
    whiteSpace: "pre-wrap",
  },
  noteDraft: {
    display: "grid",
    gap: "0.45rem",
  },
  pre: {
    whiteSpace: "pre-wrap",
    backgroundColor: tokens.bg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.border,
    borderRadius: 6,
    padding: "0.6rem",
    maxHeight: "10rem",
    overflow: "auto",
    fontFamily: tokens.fontMono,
  },
  treeHost: {
    flexGrow: 1,
    minHeight: 0,
  },
});

export function Badge({ children }: { children: ReactNode }) {
  return <span {...stylex.props(styles.badge)}>{children}</span>;
}

export function Button({
  variant = "default",
  active = false,
  chev,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ok" | "danger";
  active?: boolean;
  chev?: "take" | "reject";
}) {
  return (
    <button
      {...rest}
      {...stylex.props(
        chev ? styles.chev : styles.btn,
        !chev && styles.btnHover,
        !chev && styles.btnDisabled,
        variant === "primary" && styles.primary,
        variant === "ok" && styles.ok,
        variant === "danger" && styles.danger,
        active && variant === "ok" && styles.okActive,
        active && variant === "danger" && styles.dangerActive,
        chev === "take" && styles.chevTake,
        chev === "reject" && styles.chevReject,
      )}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label {...stylex.props(styles.toggle)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function Msg({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.msg)}>{children}</div>;
}

export function Row({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.row)}>{children}</div>;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} {...stylex.props(styles.textarea)} />;
}

export function Note({ children, draft = false }: { children: ReactNode; draft?: boolean }) {
  return <div {...stylex.props(styles.note, draft && styles.noteDraft)}>{children}</div>;
}

export function NoteHead({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.noteHead)}>{children}</div>;
}

export function NoteBody({ children }: { children: ReactNode }) {
  return <p {...stylex.props(styles.noteBody)}>{children}</p>;
}

export function Pre({ children }: { children: ReactNode }) {
  return <pre {...stylex.props(styles.pre)}>{children}</pre>;
}

export function TitlePath({ children }: { children: ReactNode }) {
  return <code {...stylex.props(styles.titlePath)}>{children}</code>;
}

export function AppShell({
  kind,
  badge,
  title,
  meta,
  actions,
  toolbar,
  sidebar,
  footer,
  footerSplit = false,
  children,
}: {
  kind: "review" | "solve";
  badge: string;
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  sidebar?: ReactNode;
  footer?: ReactNode;
  footerSplit?: boolean;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.root, kind === "review" ? styles.review : styles.solve)}>
      <header {...stylex.props(styles.top)}>
        <Badge>{badge}</Badge>
        {title ? <span {...stylex.props(styles.title)}>{title}</span> : null}
        <span {...stylex.props(styles.meta)}>{meta}</span>
        {actions}
      </header>
      {toolbar ? <div {...stylex.props(styles.toolbar)}>{toolbar}</div> : null}
      <div {...stylex.props(styles.body, sidebar ? styles.bodyWithSidebar : false)}>
        {sidebar ? <aside {...stylex.props(styles.sidebar)}>{sidebar}</aside> : null}
        <section {...stylex.props(styles.main)}>{children}</section>
      </div>
      {footer ? (
        <div
          {...stylex.props(styles.footer, footerSplit ? styles.footerSplit : styles.footerStack)}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function Fill({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const sx = stylex.props(styles.fill);
  return (
    <div
      className={[sx.className, className].filter(Boolean).join(" ")}
      style={{ ...sx.style, ...style }}
    >
      {children}
    </div>
  );
}

export function Status({ children }: { children: ReactNode }) {
  return <span {...stylex.props(styles.status)}>{children}</span>;
}

export const treeHostClassName = () => stylex.props(styles.treeHost).className ?? "";
