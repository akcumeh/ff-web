export class TtlCache<V> {
  #ttlMs: number;
  #store = new Map<string, { value: V; expires: number }>();

  constructor(ttlMs: number) {
    this.#ttlMs = ttlMs;
  }

  async get(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.#store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = await load();
    this.#store.set(key, { value, expires: Date.now() + this.#ttlMs });
    return value;
  }
}
