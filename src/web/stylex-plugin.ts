import path from "node:path";
import type { BunPlugin } from "bun";
import { transformAsync } from "@babel/core";
import stylexBabelPlugin from "@stylexjs/babel-plugin";
import jsxSyntaxPlugin from "@babel/plugin-syntax-jsx";
import typescriptSyntaxPlugin from "@babel/plugin-syntax-typescript";

const loaders: Record<string, "js" | "jsx" | "ts" | "tsx"> = {
  ".js": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
};

const stylexOpts = {
  dev: true,
  runtimeInjection: true,
  importSources: ["@stylexjs/stylex"],
  treeshakeCompensation: false,
  unstable_moduleResolution: { type: "commonJS" as const, rootDir: process.cwd() },
};

/** onLoad-only so it works with Bun.plugin (HTML imports) and Bun.build. */
const stylexPlugin: BunPlugin = {
  name: "stylex",
  setup(build) {
    build.onLoad({ filter: /\.[cm]?[jt]sx$/ }, async (args) => {
      if (args.path.includes(`${path.sep}node_modules${path.sep}`)) return undefined;
      const code = await Bun.file(args.path).text();
      if (!code.includes("@stylexjs/stylex")) return undefined;
      const result = await transformAsync(code, {
        babelrc: false,
        configFile: false,
        filename: args.path,
        plugins: [
          [typescriptSyntaxPlugin, { isTSX: args.path.endsWith("x") }],
          jsxSyntaxPlugin,
          stylexBabelPlugin.withOptions(stylexOpts),
        ],
      });
      if (!result?.code) return undefined;
      return {
        contents: result.code,
        loader: loaders[path.extname(args.path)] ?? "js",
      };
    });
  },
};

export default stylexPlugin;
