/**
 * 手写 boundedGather
 *
 * 考点：
 * - 用信号量限制并发数。
 * - 保持结果顺序。
 * - 支持 AbortSignal。
 */

export async function boundedGather<T, R>(
  items: Iterable<T>,
  fn: (item: T, signal?: AbortSignal) => Promise<R>,
  options: { limit?: number; signal?: AbortSignal } = {}
): Promise<R[]> {
  const { limit = 5, signal } = options;
  if (limit <= 0) throw new Error("limit must be positive");

  const itemsArray = Array.from(items);
  const results: R[] = new Array(itemsArray.length);
  let running = 0;
  let index = 0;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    signal?.addEventListener("abort", () => reject(signal.reason), { once: true });

    function next(): void {
      while (running < limit && index < itemsArray.length) {
        const currentIndex = index++;
        running++;
        fn(itemsArray[currentIndex], signal)
          .then((result) => {
            results[currentIndex] = result;
          })
          .catch(reject)
          .finally(() => {
            running--;
            next();
          });
      }
      if (running === 0 && index >= itemsArray.length) {
        resolve(results);
      }
    }

    next();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    const results = await boundedGather(
      [1, 2, 3, 4, 5],
      async (n) => n * 2,
      { limit: 2 }
    );
    console.log(results); // [2, 4, 6, 8, 10]
  }
  demo();
}
