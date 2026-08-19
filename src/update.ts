import { basename, dirname, join } from "node:path";
import { chmodSync, mkdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import {
  fromPromise,
  fromThrowable,
  isErrored,
  mapError,
  valueOrElse,
  type AsyncResult,
} from "@attio/fetchable";
import pkg from "../package.json" with { type: "json" };
import { FetchError, fetcher } from "./utils/fetcher.ts";
import { logger } from "./utils/logger.ts";
import { errMsg } from "./utils/errors.ts";

export const VERSION = pkg.version;
export const REPO = "victorfern91/toolbelt";

const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const CACHE = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "toolbelt",
  "update.json",
);
const DAY = 86_400_000;

type Release = {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
};

type CacheEntry = { checkedAt: number; latest: string };

export const assetName = () => `toolbelt-${process.platform}-${process.arch}`;

/** true when running as the compiled binary rather than `bun src/cli.tsx` */
export const isBinary = () => !basename(process.execPath).startsWith("bun");

// ponytail: numeric-only compare, enough for vMAJOR.MINOR.PATCH tags.
// If prereleases ever ship, swap in Bun.semver.
export function isNewer(remote: string, local: string) {
  const parts = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [r, l] = [parts(remote), parts(local)];
  for (let i = 0; i < 3; i++) {
    const d = (r[i] ?? 0) - (l[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

const fetchLatest = async (timeoutMs = 4000): AsyncResult<Release, unknown> => {
  const res = await fetcher.get(LATEST, {
    headers: { accept: "application/vnd.github+json" },
    timeoutMs,
  });
  if (isErrored(res)) {
    return mapError(res, (e) =>
      e instanceof FetchError && e.status === 404
        ? new Error(`no releases published for ${REPO} yet`)
        : e,
    );
  }
  return fromPromise(res.value.json() as Promise<Release>);
};

/**
 * Latest version if an update exists, else null. Answers from a 24h cache,
 * so at most one network call per day and never longer than the timeout.
 */
export async function checkForUpdate(): Promise<string | null> {
  let cached = valueOrElse(
    await fromPromise(Bun.file(CACHE).json() as Promise<CacheEntry>),
    undefined,
  );

  if (!cached || Date.now() - cached.checkedAt > DAY) {
    // offline, rate-limited, no release yet — never block the tool
    const latest = await fetchLatest(1500);
    if (isErrored(latest)) return null;
    cached = { checkedAt: Date.now(), latest: latest.value.tag_name };
    if (isErrored(fromThrowable(() => mkdirSync(dirname(CACHE), { recursive: true })))) return null;
    if (isErrored(await fromPromise(Bun.write(CACHE, JSON.stringify(cached))))) return null;
  }
  return isNewer(cached.latest, VERSION) ? cached.latest : null;
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  clearLine: "\x1b[2K\r",
} as const;

function step(icon: string, color: string, msg: string) {
  process.stdout.write(`${color}${icon}${C.reset} ${msg}\n`);
}

function progress(downloaded: number, total: number | null) {
  const pct = total ? Math.round((downloaded / total) * 100) : null;
  const mb = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`;
  const bar = total
    ? (() => {
        const width = 28;
        const filled = Math.round((downloaded / total) * width);
        return `[${"█".repeat(filled)}${"░".repeat(width - filled)}] ${pct}%`;
      })()
    : "…";
  process.stdout.write(
    `${C.clearLine}${C.cyan}↓${C.reset} downloading  ${bar}  ${mb(downloaded)}${total ? ` / ${mb(total)}` : ""}`,
  );
}

export async function selfUpdate(log = logger.info) {
  if (!isBinary()) {
    log("running from source — use `git pull && bun install` instead");
    return 1;
  }

  step("◆", C.cyan, "checking for latest release…");
  const res = await fetchLatest();
  if (isErrored(res)) {
    step("✗", C.red, errMsg(res.error));
    return 1;
  }
  const release = res.value;

  if (!isNewer(release.tag_name, VERSION)) {
    step("✓", C.green, `already on the latest version (${C.bold}${VERSION}${C.reset})`);
    return 0;
  }

  const want = assetName();
  const asset = release.assets.find((a) => a.name === want);
  if (!asset) {
    step("✗", C.red, `release ${release.tag_name} has no build for ${want}`);
    return 1;
  }

  step(
    "◆",
    C.yellow,
    `${C.bold}${VERSION}${C.reset} → ${C.bold}${C.green}${release.tag_name}${C.reset}`,
  );

  // Stream the download so we can show real progress.
  const fetchRes = await fromPromise(
    fetch(asset.browser_download_url, { signal: AbortSignal.timeout(120_000) }),
  );
  if (isErrored(fetchRes) || !fetchRes.value.ok || !fetchRes.value.body) {
    step("✗", C.red, `download failed`);
    return 1;
  }

  const response = fetchRes.value;
  const total = Number(response.headers.get("content-length")) || null;
  const chunks: Uint8Array[] = [];
  let downloaded = 0;

  progress(0, total);
  const reader = response.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    downloaded += value.byteLength;
    progress(downloaded, total);
  }
  // Move past the progress line.
  process.stdout.write("\n");
  step("✓", C.green, `downloaded ${(downloaded / 1_048_576).toFixed(1)} MB`);

  step("◆", C.cyan, "installing…");
  const binary = new Uint8Array(downloaded);
  let offset = 0;
  for (const chunk of chunks) {
    binary.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const target = process.execPath;
  const tmp = join(dirname(target), `.${basename(target)}.new`);
  const swapped = await fromPromise(
    (async () => {
      await Bun.write(tmp, binary);
      chmodSync(tmp, 0o755);
      renameSync(tmp, target);
    })(),
  );
  if (isErrored(swapped)) {
    step("✗", C.red, `could not replace ${target}: ${errMsg(swapped.error)}`);
    process.stdout.write(
      `${C.dim}  retry with write access, or reinstall:\n` +
        `  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash${C.reset}\n`,
    );
    return 1;
  }

  step("✓", C.green, `${C.bold}toolbelt ${release.tag_name}${C.reset} installed — enjoy! 🚀`);
  return 0;
}
