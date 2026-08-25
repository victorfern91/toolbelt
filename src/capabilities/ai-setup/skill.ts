import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import skillMd from "./SKILL.md" with { type: "text" };
import { skillLocations } from "./skills-cli.ts";

export const TOOLBELT_SKILL = skillMd;
export const TOOLBELT_SKILL_NAME = "toolbelt";

/** `tb setup ai` / `tb upgrade ai` write the bundled skill into Cursor, Claude, and agents. */
export const applyToolbeltSkill = async (
  home: string,
  contents = TOOLBELT_SKILL,
): Promise<Result<{ paths: string[] }, unknown>> => {
  const paths = skillLocations(home, TOOLBELT_SKILL_NAME);
  const prep = await ResultAsync.fromPromise(
    Promise.all(paths.map((p) => mkdir(dirname(p), { recursive: true }))),
    (e) => e,
  );
  if (prep.isErr()) return err(prep.error);
  const wrote = await ResultAsync.fromPromise(
    Promise.all(paths.map((p) => Bun.write(p, contents))),
    (e) => e,
  );
  if (wrote.isErr()) return err(wrote.error);
  return ok({ paths });
};
