/**
 * 手写 zip
 *
 * 考点：
 * - 多序列并行迭代。
 * - strict 模式检测长度不一致。
 */

export function* zip<T extends unknown[]>(
  ...iterables: { [K in keyof T]: Iterable<T[K]> }
): Generator<T> {
  const iterators = iterables.map((it) => it[Symbol.iterator]());
  while (true) {
    const results = iterators.map((it) => it.next());
    if (results.every((r) => r.done)) break;
    if (results.some((r) => r.done)) {
      throw new Error("zip() arguments have different lengths");
    }
    yield results.map((r) => r.value) as T;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log([...zip([1, 2, 3], ["a", "b"])]);
  // [[1, 'a'], [2, 'b']]
}
