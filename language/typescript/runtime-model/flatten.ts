/**
 * 手写 flatten
 *
 * 考点：
 * - 递归展平嵌套可迭代对象。
 * - 字符串/Buffer 当作原子值。
 * - 可选 depth 控制。
 */

export function flatten<T>(iterable: Iterable<unknown>, depth: number = Infinity): T[] {
  const result: T[] = [];
  for (const item of iterable) {
    if (
      depth > 0 &&
      item !== null &&
      typeof item === "object" &&
      typeof (item as Iterable<T>)[Symbol.iterator] === "function" &&
      !(item instanceof String || typeof item === "string") &&
      !(item instanceof Buffer)
    ) {
      result.push(...flatten(item as Iterable<unknown>, depth - 1));
    } else {
      result.push(item as T);
    }
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(flatten([1, [2, [3, 4]], "hello", [5, 6]]));
  // [1, 2, 3, 4, 'hello', 5, 6]
  console.log(flatten([1, [2, [3]]], 1));
  // [1, 2, [3]]
}
