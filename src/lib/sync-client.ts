const SYNC_API_URL = process.env.SYNC_API_URL;
const SYNC_API_KEY = process.env.SYNC_API_KEY;

const DEFAULT_TIMEOUT_MS = 30_000;

export async function syncFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  if (!SYNC_API_URL) {
    throw new Error("SYNC_API_URL no configurada");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(SYNC_API_KEY ? { "x-api-key": SYNC_API_KEY } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${SYNC_API_URL}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([controller.signal, options.signal])
        : controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timeout: sync API no respondio en ${timeoutMs / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Sync API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
