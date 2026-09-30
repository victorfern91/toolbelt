import plugin from "./stylex-plugin.ts";

let registered = false;

export const registerStylex = () => {
  if (registered) return;
  registered = true;
  Bun.plugin(plugin);
};

registerStylex();
