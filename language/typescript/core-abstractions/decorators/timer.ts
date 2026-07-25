/**
 * 手写 timer 装饰器
 *
 * 考点：
 * - 高阶函数包装原函数。
 * - 测量执行耗时。
 */

export function timer<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => ReturnType<T> {
  return function (...args: Parameters<T>): ReturnType<T> {
    const start = performance.now();
    const result = fn(...args);
    console.log(`${fn.name} took ${(performance.now() - start).toFixed(3)}ms`);
    return result as ReturnType<T>;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const add = timer((a: number, b: number) => a + b);
  console.log(add(1, 2));
}
