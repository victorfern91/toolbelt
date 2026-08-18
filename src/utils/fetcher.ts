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

/** Thin wrapper over fetch; throws FetchError on non-2xx. */
async function get(url: string, options: FetchOptions = {}): Promise<Response> {
  const { headers, timeoutMs = 4000 } = options;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new FetchError(url, res.status);
  return res;
}

export const fetcher = { get };
