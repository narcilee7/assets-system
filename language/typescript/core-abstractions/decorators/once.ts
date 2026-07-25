/**
 * 手写 once
 *
 * 考点：
 * - 保证函数只执行一次。
 * - Promise 安全：首次返回的 Promise 被复用。
 */

export function once<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  let called = false;
  let result: ReturnType<T>;

  return function (...args: Parameters<T>): ReturnType<T> {
    if (called) return result;
    called = true;
    result = fn(...args) as ReturnType<T>;
    return result;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const init = once(() => {
    console.log("initializing");
    return 42;
  });
  console.log(init());
  console.log(init());
}
