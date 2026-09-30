import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import stylexPlugin from "./stylex-plugin.ts";

export type BundledUi = { outdir: string; dispose: () => void };

export async function bundleHtml(entry: string): Promise<BundledUi> {
  const outdir = mkdtempSync(join(tmpdir(), "tb-ui-"));
  const r = await Bun.build({
    entrypoints: [entry],
    outdir,
    plugins: [stylexPlugin],
  });
  if (!r.success) {
    rmSync(outdir, { recursive: true, force: true });
    const detail = r.logs.map(String).join("\n") || "ui bundle failed";
    throw new Error(detail);
  }
  return {
    outdir,
    dispose: () => rmSync(outdir, { recursive: true, force: true }),
  };
}

export const staticFile = async (outdir: string, req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  if (!rel || rel.includes("..") || rel.startsWith("/")) {
    return new Response("not found", { status: 404 });
  }
  const file = Bun.file(join(outdir, rel));
  if (!(await file.exists())) return new Response("not found", { status: 404 });
  return new Response(file);
};
