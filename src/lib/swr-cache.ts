/**
 * Tiny in-memory stale-while-revalidate cache for section data.
 *
 * Sections (Feed, Marketplace, Academy, Hub…) unmount when the user switches
 * tabs, which otherwise means a full network round-trip and a skeleton every
 * single time. Reading the last payload from here paints instantly while the
 * fresh request lands in the background.
 *
 * Lives for the browser session only — nothing is persisted, so signing out or
 * reloading always starts from a clean slate.
 */

type Entry = { value: unknown; at: number };

const store = new Map<string, Entry>();

/** Default freshness window before a cached payload is considered stale. */
export const DEFAULT_TTL = 90_000;

/** Read a cached payload. Returns `undefined` when missing or expired. */
export function readCache<T>(key: string, ttl: number = DEFAULT_TTL): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttl) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

/** Store a payload for later instant paints. */
export function writeCache<T>(key: string, value: T): T {
  store.set(key, { value, at: Date.now() });
  return value;
}

/** Drop cached payloads. Pass a prefix to clear one family of keys. */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
