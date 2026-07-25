/**
 * 手写 chunk
 *
 * 考点：
 * - 将可迭代对象按固定大小分块。
 * - 支持 fill 填充最后一项。
 * - 生成器实现，惰性消费。
 */

export function* chunk<T>(iterable: Iterable<T>, size: number, fill?: T): Generator<T[]> {
  if (size <= 0) {
    throw new Error("size must be positive");
  }

  let batch: T[] = [];
  for (const item of iterable) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    if (fill !== undefined) {
      while (batch.length < size) {
        batch.push(fill);
      }
    }
    yield batch;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log([...chunk([1, 2, 3, 4, 5], 2)]);
  // [[1, 2], [3, 4], [5]]
  console.log([...chunk([1, 2, 3, 4, 5], 2, 0)]);
  // [[1, 2], [3, 4], [5, 0]]
}
