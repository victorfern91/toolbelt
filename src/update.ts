import { basename, dirname, join } from "node:path";
import { chmodSync, lstatSync, renameSync, symlinkSync } from "node:fs";
import { err, ResultAsync, type Result } from "neverthrow";
import pkg from "../package.json" with { type: "json" };
import { FetchError, fetcher } from "./utils/fetcher.ts";
import { logger } from "./utils/logger.ts";
import { errMsg } from "./utils/errors.ts";
import { ansi } from "./ui/theme.ts";

export const VERSION = pkg.version;
export const REPO = "victorfern91/toolbelt";

const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;

type Release = {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
};

export const assetName = () => `toolbelt-${process.platform}-${process.arch}`;

/** true when running as the compiled binary rather than `bun src/cli.tsx` */
export const isBinary = () => !basename(process.execPath).startsWith("bun");

/**
 * `tb` → `toolbelt` in the same directory as the binary.
 * Creates the link when missing; leaves an existing file or other symlink alone.
 * Returns true when a new link was written.
 */
export function ensureTbSymlink(execPath = process.execPath): boolean {
  const tb = join(dirname(execPath), "tb");
  try {
    lstatSync(tb);
    return false;
  } catch {
    symlinkSync("toolbelt", tb);
    return true;
  }
}

/** Always replace the canonical `toolbelt` binary, even when invoked as `tb`. */
export function installTarget(execPath = process.execPath) {
  const dir = dirname(execPath);
  return basename(execPath) === "tb" ? join(dir, "toolbelt") : execPath;
}

export function isNewer(remote: string, local: string) {
  return Bun.semver.order(remote, local) > 0;
}

const fetchLatest = async (timeoutMs = 4000): Promise<Result<Release, unknown>> => {
  const res = await fetcher.get(LATEST, {
    headers: { accept: "application/vnd.github+json" },
    timeoutMs,
  });
  if (res.isErr()) {
    return err(
      res.error instanceof FetchError && res.error.status === 404
        ? new Error(`no releases published for ${REPO} yet`)
        : res.error,
    );
  }
  return ResultAsync.fromPromise(res.value.json() as Promise<Release>, (e) => e);
};

/**
 * Latest version if an update exists, else null.
 * Always hits GitHub (1.5s cap); offline / rate-limited → null, never throws.
 */
export async function checkForUpdate(localVersion = VERSION): Promise<string | null> {
  const latest = await fetchLatest(1500);
  if (latest.isErr()) return null;
  return isNewer(latest.value.tag_name, localVersion) ? latest.value.tag_name : null;
}

/** stdout banner for non-interactive commands */
export function printUpdateBanner(latest: string) {
  const line = `  🚀 toolbelt ${latest} is available  (you have ${VERSION})  `;
  const hint = `     run ${ansi.bold}${ansi.accent}toolbelt upgrade${ansi.reset}${ansi.warn} to update                  `;
  const bar = "─".repeat(line.length - 2);
  console.log(
    `${ansi.warn}┌${bar}┐${ansi.reset}\n` +
      `${ansi.warn}│${ansi.reset}${ansi.bold}${line}${ansi.reset}${ansi.warn}│${ansi.reset}\n` +
      `${ansi.warn}│${ansi.reset}${hint}${ansi.warn}│${ansi.reset}\n` +
      `${ansi.warn}└${bar}┘${ansi.reset}\n`,
  );
}

export async function maybePrintUpdateBanner(check: Promise<string | null>) {
  const latest = await check;
  if (latest) printUpdateBanner(latest);
}

function step(icon: string, paint: string, msg: string) {
  process.stdout.write(`${paint}${icon}${ansi.reset} ${msg}\n`);
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
    `${ansi.clearLine}${ansi.accent}↓${ansi.reset} downloading  ${bar}  ${mb(downloaded)}${total ? ` / ${mb(total)}` : ""}`,
  );
}

export async function selfUpdate(log = logger.info) {
  if (!isBinary()) {
    log("running from source — use `git pull && bun install` instead");
    return 1;
  }

  step("◆", ansi.accent, "checking for latest release…");
  const res = await fetchLatest();
  if (res.isErr()) {
    step("✗", ansi.danger, errMsg(res.error));
    return 1;
  }
  const release = res.value;

  if (!isNewer(release.tag_name, VERSION)) {
    step("✓", ansi.ok, `already on the latest version (${ansi.bold}${VERSION}${ansi.reset})`);
    try {
      if (ensureTbSymlink(installTarget())) {
        step("✓", ansi.ok, `linked ${ansi.bold}tb${ansi.reset} → toolbelt`);
      }
    } catch {
      // no write access — binary is still current
    }
    return 0;
  }

  const want = assetName();
  const asset = release.assets.find((a) => a.name === want);
  if (!asset) {
    step("✗", ansi.danger, `release ${release.tag_name} has no build for ${want}`);
    return 1;
  }

  step(
    "◆",
    ansi.warn,
    `${ansi.bold}${VERSION}${ansi.reset} → ${ansi.bold}${ansi.ok}${release.tag_name}${ansi.reset}`,
  );

  // Stream the download so we can show real progress.
  const fetchRes = await ResultAsync.fromPromise(
    fetch(asset.browser_download_url, { signal: AbortSignal.timeout(120_000) }),
    (e) => e,
  );
  if (fetchRes.isErr() || !fetchRes.value.ok || !fetchRes.value.body) {
    step("✗", ansi.danger, `download failed`);
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
  step("✓", ansi.ok, `downloaded ${(downloaded / 1_048_576).toFixed(1)} MB`);

  step("◆", ansi.accent, "installing…");
  const binary = Bun.concatArrayBuffers(chunks);

  const target = installTarget();
  const tmp = join(dirname(target), `.${basename(target)}.new`);
  const swapped = await ResultAsync.fromPromise(
    (async () => {
      await Bun.write(tmp, binary);
      chmodSync(tmp, 0o755);
      renameSync(tmp, target);
    })(),
    (e) => e,
  );
  if (swapped.isErr()) {
    step("✗", ansi.danger, `could not replace ${target}: ${errMsg(swapped.error)}`);
    process.stdout.write(
      `${ansi.dim}  retry with write access, or reinstall:\n` +
        `  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash${ansi.reset}\n`,
    );
    return 1;
  }

  try {
    if (ensureTbSymlink(target)) {
      step("✓", ansi.ok, `linked ${ansi.bold}tb${ansi.reset} → toolbelt`);
    }
  } catch (e) {
    step("…", ansi.warn, `could not link tb: ${errMsg(e)}`);
  }

  step("✓", ansi.ok, `${ansi.bold}toolbelt ${release.tag_name}${ansi.reset} installed — enjoy! 🚀`);
  return 0;
}
