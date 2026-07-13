/**
 * 手写 Promise.any
 *
 * 考点：
 * - 第一个 fulfilled 的 Promise 决定结果。
 * - 全部 reject 时抛 AggregateError。
 */

export function promiseAny<T extends readonly unknown[]>(
  promises: { [K in keyof T]: Promise<T[K]> | T[K] }
): Promise<T[number]> {
  return new Promise((resolve, reject) => {
    const errors: unknown[] = [];
    let remaining = promises.length;

    if (remaining === 0) {
      reject(new AggregateError([], "All promises were rejected"));
      return;
    }

    promises.forEach((promise, index) => {
      Promise.resolve(promise).then(
        resolve,
        (reason) => {
          errors[index] = reason;
          remaining--;
          if (remaining === 0) {
            reject(new AggregateError(errors, "All promises were rejected"));
          }
        }
      );
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  promiseAny([Promise.reject("err"), Promise.resolve("ok"), Promise.reject("err2")]).then(
    console.log
  );
  // 'ok'
}
