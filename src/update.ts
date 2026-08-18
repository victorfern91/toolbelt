import { basename, dirname, join } from "node:path";
import { chmodSync, mkdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import pkg from "../package.json" with { type: "json" };

export const VERSION = pkg.version;
export const REPO = "victorfern91/toolbelt";

const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const CACHE = join(
  process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
  "toolbelt",
  "update.json",
);
const DAY = 86_400_000;

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

async function fetchLatest(timeoutMs = 4000) {
  const res = await fetch(LATEST, {
    headers: { accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 404) throw new Error(`no releases published for ${REPO} yet`);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return (await res.json()) as {
    tag_name: string;
    assets: { name: string; browser_download_url: string }[];
  };
}

/**
 * Latest version if an update exists, else null. Answers from a 24h cache,
 * so at most one network call per day and never longer than the timeout.
 */
export async function checkForUpdate(): Promise<string | null> {
  let cached: { checkedAt: number; latest: string } | undefined;
  try {
    cached = await Bun.file(CACHE).json();
  } catch {}

  if (!cached || Date.now() - cached.checkedAt > DAY) {
    try {
      const latest = (await fetchLatest(1500)).tag_name;
      cached = { checkedAt: Date.now(), latest };
      mkdirSync(dirname(CACHE), { recursive: true });
      await Bun.write(CACHE, JSON.stringify(cached));
    } catch {
      // offline, rate-limited, no release yet — never block the tool
      return null;
    }
  }
  return isNewer(cached.latest, VERSION) ? cached.latest : null;
}

export async function selfUpdate(log = console.log) {
  if (!isBinary()) {
    log("running from source — use `git pull && bun install` instead");
    return 1;
  }

  const release = await fetchLatest();
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
  const res = await fetch(asset.browser_download_url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);

  // Same directory so the rename is atomic and stays on one filesystem.
  const target = process.execPath;
  const tmp = join(dirname(target), `.${basename(target)}.new`);
  try {
    await Bun.write(tmp, res);
    chmodSync(tmp, 0o755);
    renameSync(tmp, target);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`✗ could not replace ${target}: ${msg}`);
    log(`  retry with write access, or reinstall:`);
    log(`  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`);
    return 1;
  }

  log(`✓ toolbelt ${release.tag_name}`);
  return 0;
}
