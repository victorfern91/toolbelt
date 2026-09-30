import { join } from "node:path";
import { err, ok, type Result } from "neverthrow";
import { applyResolutions, collectConflicts } from "../../capabilities/solve/snapshot.ts";
import type { ApplyFile, ConflictSnapshot } from "../../capabilities/solve/types.ts";
import { openBrowser } from "../../utils/open.ts";
import { bundleHtml, staticFile } from "../../web/hosted.ts";

export type SolveHost = {
  url: string;
  stop: () => void;
  done: Promise<"applied" | "abandoned">;
};

const parseApply = (body: unknown): ApplyFile[] | Error => {
  if (body == null || typeof body !== "object") return new Error("invalid json");
  const files = (body as { files?: unknown }).files;
  if (!Array.isArray(files) || files.length === 0) return new Error("files required");
  const out: ApplyFile[] = [];
  for (const f of files) {
    if (f == null || typeof f !== "object") return new Error("invalid file");
    const path = (f as { path?: unknown }).path;
    const contents = (f as { contents?: unknown }).contents;
    if (typeof path !== "string" || !path) return new Error("path required");
    if (contents !== null && typeof contents !== "string") return new Error("contents required");
    out.push({ path, contents });
  }
  return out;
};

const listen = (
  port: number,
  snapshot: ConflictSnapshot,
  outdir: string,
  finish: (outcome: "applied" | "abandoned") => void,
) =>
  Bun.serve({
    port,
    hostname: "127.0.0.1",
    routes: {
      "/api/snapshot": {
        GET: () => Response.json(snapshot),
      },
      "/api/apply": {
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "invalid json" }, { status: 400 });
          }
          const files = parseApply(body);
          if (files instanceof Error)
            return Response.json({ error: files.message }, { status: 400 });
          const r = await applyResolutions(snapshot.root, files);
          if (r.isErr()) {
            return Response.json({ error: String(r.error) }, { status: 500 });
          }
          if (!r.value.remaining.length) queueMicrotask(() => finish("applied"));
          return Response.json({ ok: true, remaining: r.value.remaining });
        },
      },
      "/api/abandon": {
        POST: () => {
          queueMicrotask(() => finish("abandoned"));
          return new Response(null, { status: 204 });
        },
      },
      "/*": (req: Request) => staticFile(outdir, req),
    },
  });

export const startSolveHost = async (opts?: {
  port?: number;
  open?: boolean;
  snapshot?: ConflictSnapshot;
}): Promise<Result<SolveHost, unknown>> => {
  const snap = opts?.snapshot != null ? ok(opts.snapshot) : await collectConflicts();
  if (snap.isErr()) return err(snap.error);
  if (!snap.value.files.length) return err(new Error("no remaining conflicts"));

  let settled = false;
  let resolveDone!: (outcome: "applied" | "abandoned") => void;
  const done = new Promise<"applied" | "abandoned">((resolve) => {
    resolveDone = resolve;
  });
  const finish = (outcome: "applied" | "abandoned") => {
    if (settled) return;
    settled = true;
    resolveDone(outcome);
  };

  let ui: Awaited<ReturnType<typeof bundleHtml>>;
  try {
    ui = await bundleHtml(join(import.meta.dir, "app/index.html"));
  } catch (e) {
    return err(e);
  }
  const preferred = opts?.port ?? 4174;
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = listen(preferred, snap.value, ui.outdir, finish);
  } catch {
    server = listen(0, snap.value, ui.outdir, finish);
  }

  const url = `http://127.0.0.1:${server.port}`;
  if (opts?.open !== false) openBrowser(url);

  return ok({
    url,
    done,
    stop: () => {
      server.stop(true);
      ui.dispose();
    },
  });
};

export const runSolveHost = async (): Promise<Result<void, unknown>> => {
  const host = await startSolveHost({ open: true });
  if (host.isErr()) return err(host.error);
  console.error(`solve UI: ${host.value.url}`);
  console.error("resolve conflicts in the browser — waiting (close tab = leave remaining)");
  const outcome = await host.value.done;
  await Bun.sleep(200);
  host.value.stop();
  if (outcome === "abandoned") {
    console.error("abandoned — remaining conflicts left in the worktree");
    return ok(undefined);
  }
  console.error("conflicts applied and staged — continue the merge/rebase");
  return ok(undefined);
};
