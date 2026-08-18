/** Normalize a caught unknown into a printable message. */
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
