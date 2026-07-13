/**
 * 手写 groupBy
 *
 * 考点：
 * - 按键函数分组。
 * - 可选 transform。
 */

export function groupBy<T, K extends string | number | symbol>(
  iterable: Iterable<T>,
  key: (item: T) => K,
  transform?: (item: T) => T
): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;
  for (const item of iterable) {
    const k = key(item);
    if (!groups[k]) groups[k] = [];
    groups[k].push(transform ? transform(item) : item);
  }
  return groups;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const words = ["apple", "banana", "avocado"];
  console.log(groupBy(words, (w) => w[0]));
  // { a: ['apple', 'avocado'], b: ['banana'] }
}
