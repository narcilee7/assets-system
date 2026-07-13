/**
 * 手写 LRU Cache
 *
 * 考点：
 * - Map 维护插入顺序，可当作双向链表使用。
 * - get / put 都更新最近使用位置。
 */

export class LRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private capacity: number) {
    if (capacity <= 0) throw new Error("capacity must be positive");
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cache = new LRUCache<number, string>(2);
  cache.put(1, "a");
  cache.put(2, "b");
  cache.get(1);
  cache.put(3, "c");
  console.log(cache.has(2)); // false
}
