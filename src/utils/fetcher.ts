import { complete, errored, fromPromise, isErrored, type AsyncResult } from "@attio/fetchable";

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

/** Thin wrapper over fetch: Complete<Response> on 2xx, Errored otherwise (FetchError on non-2xx). */
const get = async (
  url: string,
  { headers, timeoutMs = 4000 }: FetchOptions = {},
): AsyncResult<Response, unknown> => {
  const res = await fromPromise(fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) }));
  if (isErrored(res)) return res;
  return res.value.ok ? complete(res.value) : errored(new FetchError(url, res.value.status));
};

export const fetcher = { get };
