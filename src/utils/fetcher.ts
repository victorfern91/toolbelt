import { err, ok, ResultAsync, type Result } from "neverthrow";

type FetchOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export class FetchError extends Error {
  constructor(
    url: string,
    public status: number,
  ) {
    super(`GET ${url} failed: ${status}`);
  }
}

/** Thin wrapper over fetch: Ok<Response> on 2xx, Err otherwise (FetchError on non-2xx). */
const get = async (
  url: string,
  { headers, timeoutMs = 4000 }: FetchOptions = {},
): Promise<Result<Response, unknown>> => {
  const res = await ResultAsync.fromPromise(
    fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) }),
    (e) => e,
  );
  if (res.isErr()) return res;
  return res.value.ok ? ok(res.value) : err(new FetchError(url, res.value.status));
};

export const fetcher = { get };
