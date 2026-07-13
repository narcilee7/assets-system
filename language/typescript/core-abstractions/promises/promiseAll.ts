/**
 * 手写 Promise.all
 *
 * 考点：
 * - 所有 Promise 完成才 resolve。
 * - 任一 reject 立即 reject。
 */

export function promiseAll<T extends readonly unknown[]>(
  promises: { [K in keyof T]: Promise<T[K]> | T[K] }
): Promise<T> {
  return new Promise((resolve, reject) => {
    const results = new Array(promises.length) as T;
    let remaining = promises.length;

    if (remaining === 0) {
      resolve(results);
      return;
    }

    promises.forEach((promise, index) => {
      Promise.resolve(promise).then(
        (value) => {
          results[index] = value;
          remaining--;
          if (remaining === 0) resolve(results);
        },
        reject
      );
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  promiseAll([Promise.resolve(1), Promise.resolve("a"), 3]).then(console.log);
  // [1, 'a', 3]
}
