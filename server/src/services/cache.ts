import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, {}>({
  max: 2000,
  ttl: 1000 * 60 * 30, // 30 minutes
});

export async function cachedFetch<T extends {}>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = cache.get(key) as T | undefined;
  if (cached !== undefined) {
    return cached;
  }
  const value = await fetcher();
  cache.set(key, value);
  return value;
}

/**
 * Serializes calls per named API to a minimum spacing, so bursts of concurrent
 * requests (e.g. hydrating a whole album's tracks) don't trip a provider's rate limit.
 */
class RateLimiter {
  private queues = new Map<string, Promise<void>>();

  constructor(private readonly minIntervalMs: number) {}

  async schedule<T>(bucket: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(bucket) ?? Promise.resolve();
    let release: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.queues.set(
      bucket,
      previous.then(() => gate)
    );

    await previous;
    try {
      return await task();
    } finally {
      setTimeout(() => release(), this.minIntervalMs);
    }
  }
}

export const itunesRateLimiter = new RateLimiter(150);
export const lastfmRateLimiter = new RateLimiter(200);
export const musicbrainzRateLimiter = new RateLimiter(1100); // MB asks for <=1 req/sec
