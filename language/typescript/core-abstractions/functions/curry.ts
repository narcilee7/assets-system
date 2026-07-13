/**
 * 手写 curry
 *
 * 考点：
 * - 分步收集参数。
 * - 参数足够时调用原函数。
 */

export function curry<T extends unknown[], R>(
  fn: (...args: T) => R
): Curried<T, R> {
  return function curried(...args: unknown[]): unknown {
    if (args.length >= fn.length) {
      return fn(...(args as T));
    }
    return (...next: unknown[]) => curried(...args, ...next);
  } as Curried<T, R>;
}

type Curried<T extends unknown[], R> = T extends [infer A, ...infer Rest]
  ? (arg: A) => Rest extends []
    ? R
    : Curried<Rest, R>
  : () => R;

if (import.meta.url === `file://${process.argv[1]}`) {
  const add = (a: number, b: number, c: number) => a + b + c;
  const curriedAdd = curry(add);
  console.log(curriedAdd(1)(2)(3));
}
