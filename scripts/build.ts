#!/usr/bin/env bun
// Compiles standalone binaries into dist/, named the way src/update.ts and
// install.sh expect: toolbelt-<platform>-<arch>.
//   bun run build        current platform, dist/toolbelt
//   bun run build:all    every release target
import type { BunPlugin } from "bun";

const TARGETS = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-x64": "bun-linux-x64",
  "linux-arm64": "bun-linux-arm64",
} as const;

// Ink pulls in react-devtools-core behind a `DEV=true` guard. The bundler still
// has to resolve it, so stub it out rather than shipping the devtools client.
const stubDevtools: BunPlugin = {
  name: "stub-react-devtools",
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: "react-devtools-core",
      namespace: "stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export default {};",
      loader: "js",
    }));
  },
};

const all = Bun.argv.includes("--all");
const jobs = all
  ? Object.entries(TARGETS).map(([name, target]) => ({ target, outfile: `dist/toolbelt-${name}` }))
  : [{ target: undefined, outfile: "dist/toolbelt" }];

for (const { target, outfile } of jobs) {
  const res = await Bun.build({
    entrypoints: ["src/cli.tsx"],
    minify: true,
    plugins: [stubDevtools],
    compile: { outfile, ...(target ? { target } : {}) },
  });
  if (!res.success) {
    for (const l of res.logs) console.error(l);
    process.exit(1);
  }
  console.log(`✓ ${outfile} (${(Bun.file(outfile).size / 1e6).toFixed(0)} MB)`);
}
