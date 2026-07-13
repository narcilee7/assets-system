/**
 * 手写 enumerate
 *
 * 考点：
 * - 同时返回索引和值。
 * - 支持自定义 start。
 */

export function* enumerate<T>(iterable: Iterable<T>, start: number = 0): Generator<[number, T]> {
  let index = start;
  for (const item of iterable) {
    yield [index++, item];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log([...enumerate(["a", "b", "c"])]);
  // [[0, 'a'], [1, 'b'], [2, 'c']]
}
