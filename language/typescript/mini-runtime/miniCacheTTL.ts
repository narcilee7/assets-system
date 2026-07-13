/**
 * 手写 mini cache with TTL + LRU
 *
 * 考点：
 * - TTL 过期、LRU 驱逐、事件通知。
 * - 引用保持与内存安全。
 */

export interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
}

export type CacheEvent = "set" | "get" | "evict" | "expire";

export class MiniCacheTTL<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private defaultTTL: number;
  private listeners = new Map<CacheEvent, Array<(key: K, value?: V) => void>>();

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? Number.POSITIVE_INFINITY;
    this.defaultTTL = options.defaultTTL ?? Number.POSITIVE_INFINITY;
  }

  set(key: K, value: V, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.cache.keys().next().value as K;
      const lruValue = this.cache.get(lruKey)?.value;
      this.cache.delete(lruKey);
      this.emit("evict", lruKey, lruValue);
    }

    const effectiveTTL = ttl ?? this.defaultTTL;
    const expiresAt = effectiveTTL === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Date.now() + effectiveTTL;
    this.cache.set(key, { value, expiresAt });
    this.emit("set", key, value);
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      this.emit("expire", key, entry.value);
      return undefined;
    }

    // LRU: touch key
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.emit("get", key, entry.value);
    return entry.value;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      this.emit("expire", key, entry.value);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    this.cache.delete(key);
    this.emit("evict", key, entry.value);
    return true;
  }

  on(event: CacheEvent, listener: (key: K, value?: V) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
    return () => {
      const list = this.listeners.get(event);
      if (!list) return;
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  private emit(event: CacheEvent, key: K, value?: V): void {
    this.listeners.get(event)?.forEach((listener) => listener(key, value));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cache = new MiniCacheTTL<string, number>({ maxSize: 2, defaultTTL: 1000 });
  cache.set("a", 1);
  console.log(cache.get("a"));
}
