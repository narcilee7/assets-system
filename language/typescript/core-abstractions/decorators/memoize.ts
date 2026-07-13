/**
 * 手写 memoize
 *
 * 考点：
 * - 泛型缓存。
 * - LRU 驱逐。
 * - 支持 key 函数。
 */

export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: { maxSize?: number; key?: (...args: Parameters<T>) => string } = {}
): T & { cache: Map<string, ReturnType<T> > } {
  const { maxSize = Infinity, key } = options;
  const cache = new Map<string, ReturnType<T>>();

  const memoized = function (...args: Parameters<T>): ReturnType<T> {
    const cacheKey = key ? key(...args) : JSON.stringify(args);
    if (cache.has(cacheKey)) {
      const value = cache.get(cacheKey)!;
      cache.delete(cacheKey);
      cache.set(cacheKey, value);
      return value;
    }
    const result = fn(...args) as ReturnType<T>;
    cache.set(cacheKey, result);
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    return result;
  } as T & { cache: Map<string, ReturnType<T>> };

  memoized.cache = cache;
  return memoized;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fib = memoize((n: number): number => (n < 2 ? n : fib(n - 1) + fib(n - 2)), {
    maxSize: 100,
  });
  console.log(fib(10));
}
