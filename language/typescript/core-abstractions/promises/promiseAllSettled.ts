/**
 * 手写 Promise.allSettled
 *
 * 考点：
 * - 等待所有 Promise settle，不短路。
 * - 返回 { status, value } / { status, reason }。
 */

export function promiseAllSettled<T extends readonly unknown[]>(
  promises: { [K in keyof T]: Promise<T[K]> | T[K] }
): Promise<
  {
    [K in keyof T]:
      | { status: "fulfilled"; value: T[K] }
      | { status: "rejected"; reason: unknown };
  }
> {
  return new Promise((resolve) => {
    const results = new Array(promises.length) as {
      [K in keyof T]:
        | { status: "fulfilled"; value: T[K] }
        | { status: "rejected"; reason: unknown };
    };
    let remaining = promises.length;

    if (remaining === 0) {
      resolve(results);
      return;
    }

    promises.forEach((promise, index) => {
      Promise.resolve(promise).then(
        (value) => {
          results[index] = { status: "fulfilled", value };
          remaining--;
          if (remaining === 0) resolve(results);
        },
        (reason) => {
          results[index] = { status: "rejected", reason };
          remaining--;
          if (remaining === 0) resolve(results);
        }
      );
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  promiseAllSettled([Promise.resolve(1), Promise.reject("err"), 3]).then(console.log);
}
