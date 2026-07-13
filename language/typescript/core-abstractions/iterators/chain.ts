/**
 * 手写 chain
 *
 * 考点：
 * - 多个可迭代对象顺序拼接。
 * - 惰性消费。
 */

export function* chain<T>(...iterables: Iterable<T>[]): Generator<T> {
  for (const iterable of iterables) {
    yield* iterable;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log([...chain([1, 2], [3, 4], new Set([5, 6]))]);
  // [1, 2, 3, 4, 5, 6]
}
