/**
 * 手写 dedup
 *
 * 考点：
 * - 保持顺序去重。
 * - 支持 key 函数自定义去重依据。
 */

export function dedup<T>(iterable: Iterable<T>, key?: (item: T) => unknown): T[] {
  const result: T[] = [];
  const seen = new Set<unknown>();
  for (const item of iterable) {
    const identity = key ? key(item) : item;
    if (!seen.has(identity)) {
      seen.add(identity);
      result.push(item);
    }
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(dedup([1, 2, 2, 3, 1]));
  // [1, 2, 3]
  console.log(dedup(["Apple", "banana", "apricot"], (w) => w.toLowerCase()));
  // ['Apple', 'banana']
}
