/**
 * Tiny in-memory TTL cache with request dedupe.
 * Safe for ~50–100 concurrent clients: per-device memory only, not shared state.
 */
export type TtlCache<T> = {
  get: () => T | null;
  set: (data: T) => void;
  clear: () => void;
  getOrFetch: (fetcher: () => Promise<T>, force?: boolean) => Promise<T>;
};

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  let entry: { data: T; at: number } | null = null;
  let inflight: Promise<T> | null = null;

  const get = (): T | null => {
    if (!entry) return null;
    if (Date.now() - entry.at > ttlMs) return null;
    return entry.data;
  };

  const set = (data: T) => {
    entry = { data, at: Date.now() };
  };

  const clear = () => {
    entry = null;
  };

  const getOrFetch = async (
    fetcher: () => Promise<T>,
    force = false,
  ): Promise<T> => {
    if (!force) {
      const cached = get();
      if (cached !== null) return cached;
    }

    // Dedupe concurrent fetches (including force:true from Promise.all callers).
    if (inflight) return inflight;

    inflight = (async () => {
      const data = await fetcher();
      set(data);
      return data;
    })();

    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  };

  return { get, set, clear, getOrFetch };
}
