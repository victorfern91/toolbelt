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

export async function selfUpdate(log = logger.info) {
  if (!isBinary()) {
    log("running from source — use `git pull && bun install` instead");
    return 1;
  }

  const res = await fetchLatest();
  if (isErrored(res)) {
    log(`✗ ${errMsg(res.error)}`);
    return 1;
  }
  const release = res.value;

  if (!isNewer(release.tag_name, VERSION)) {
    log(`already on the latest version (${VERSION})`);
    return 0;
  }

  const want = assetName();
  const asset = release.assets.find((a) => a.name === want);
  if (!asset) {
    log(`release ${release.tag_name} has no build for ${want}`);
    return 1;
  }

  log(`updating ${VERSION} -> ${release.tag_name}…`);
  // Binaries can be tens of MB — give the download a longer window.
  const dl = await fetcher.get(asset.browser_download_url, { timeoutMs: 60_000 });
  if (isErrored(dl)) {
    log(`✗ ${errMsg(dl.error)}`);
    return 1;
  }

  // Same directory so the rename is atomic and stays on one filesystem.
  const target = process.execPath;
  const tmp = join(dirname(target), `.${basename(target)}.new`);
  const swapped = await fromPromise(
    (async () => {
      await Bun.write(tmp, dl.value);
      chmodSync(tmp, 0o755);
      renameSync(tmp, target);
    })(),
  );
  if (isErrored(swapped)) {
    log(`✗ could not replace ${target}: ${errMsg(swapped.error)}`);
    log(`  retry with write access, or reinstall:`);
    log(`  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`);
    return 1;
  }

  log(`✓ toolbelt ${release.tag_name}`);
  return 0;
}
