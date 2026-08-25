import { err, ok, type Result } from "neverthrow";
import homepage from "./app/index.html";
import { collectSnapshot } from "../../capabilities/review/snapshot.ts";
import {
  parseFeedback,
  renderReviewPrompt,
  wrapReviewPrompt,
} from "../../capabilities/review/prompt.ts";
import type { ReviewSnapshot } from "../../capabilities/review/types.ts";

export type ReviewHost = {
  url: string;
  stop: () => void;
  done: Promise<string>;
};

const openBrowser = (url: string) => {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore", stdin: "ignore" });
};

const listen = (port: number, snapshot: ReviewSnapshot, resolve: (prompt: string) => void) =>
  Bun.serve({
    port,
    hostname: "127.0.0.1",
    routes: {
      "/": homepage,
      "/api/snapshot": {
        GET: () => Response.json(snapshot),
      },
      "/api/submit": {
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "invalid json" }, { status: 400 });
          }
          const parsed = parseFeedback(body);
          if (parsed.isErr()) return Response.json({ error: parsed.error }, { status: 400 });
          const prompt = wrapReviewPrompt(renderReviewPrompt(snapshot, parsed.value));
          queueMicrotask(() => resolve(prompt));
          return Response.json({ ok: true, prompt });
        },
      },
    },
  });

export const startReviewHost = async (opts?: {
  port?: number;
  open?: boolean;
  snapshot?: ReviewSnapshot;
}): Promise<Result<ReviewHost, unknown>> => {
  const snap = opts?.snapshot != null ? ok(opts.snapshot) : await collectSnapshot();
  if (snap.isErr()) return err(snap.error);
  if (!snap.value.files.length) return err(new Error("no local changes to review"));

  let resolveDone!: (prompt: string) => void;
  const done = new Promise<string>((resolve) => {
    resolveDone = resolve;
  });

  const preferred = opts?.port ?? 4173;
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = listen(preferred, snap.value, resolveDone);
  } catch {
    server = listen(0, snap.value, resolveDone);
  }

  const url = `http://127.0.0.1:${server.port}`;
  if (opts?.open !== false) openBrowser(url);

  return ok({
    url,
    done,
    stop: () => server.stop(true),
  });
};

export const runReviewHost = async (): Promise<Result<void, unknown>> => {
  const host = await startReviewHost({ open: true });
  if (host.isErr()) return err(host.error);
  console.error(`review UI: ${host.value.url}`);
  console.error("annotate, approve/unapprove, then submit — waiting");
  const prompt = await host.value.done;
  await Bun.sleep(200);
  host.value.stop();
  console.log(prompt);
  return ok(undefined);
};
