/**
 * 手写 Promise.race
 *
 * 考点：
 * - 第一个 settle 的 Promise 决定结果。
 */

export function promiseRace<T>(promises: Iterable<Promise<T> | T>): Promise<T> {
  return new Promise((resolve, reject) => {
    for (const promise of promises) {
      Promise.resolve(promise).then(resolve, reject);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  promiseRace([new Promise((resolve) => setTimeout(() => resolve("slow"), 100)), "fast"]).then(
    console.log
  );
  // 'fast'
}
