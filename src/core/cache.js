/** Простий TTL-кеш у пам'яті з обмеженням розміру (LRU-подібний). */

export class TTLCache {
  #map = new Map();

  /**
   * @param {{ ttlMs?: number, max?: number }} [opts]
   */
  constructor({ ttlMs = 60_000, max = 5000 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
  }

  get(key) {
    const entry = this.#map.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.#map.delete(key);
      return undefined;
    }
    // refresh recency
    this.#map.delete(key);
    this.#map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    if (this.#map.size >= this.max) {
      const oldest = this.#map.keys().next().value;
      this.#map.delete(oldest);
    }
    this.#map.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  }

  /** Отримати або обчислити (sync-фабрика). */
  getOrSet(key, factory, ttlMs) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    return this.set(key, factory(), ttlMs);
  }

  delete(key) {
    this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }

  get size() {
    return this.#map.size;
  }
}

/** Загальні кеші застосунку. */
export const caches = {
  profile: new TTLCache({ ttlMs: 30_000, max: 2000 }),
  config: new TTLCache({ ttlMs: 15_000, max: 200 }),
  aiAnalysis: new TTLCache({ ttlMs: 10 * 60_000, max: 500 }),
  leaderboard: new TTLCache({ ttlMs: 60_000, max: 20 }),
};
