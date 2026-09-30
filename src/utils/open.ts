/** Open a URL in the platform browser. Fire-and-forget; failures are silent. */
export const openBrowser = (url: string) => {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore", stdin: "ignore" });
};
