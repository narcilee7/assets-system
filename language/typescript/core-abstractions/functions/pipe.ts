/**
 * 手写 compose / pipe
 *
 * 考点：
 * - compose 从右到左组合函数。
 * - pipe 从左到右组合函数。
 */

export function compose<T>(...fns: Array<(arg: unknown) => unknown>): (value: T) => unknown {
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}

export function pipe<T>(...fns: Array<(arg: unknown) => unknown>): (value: T) => unknown {
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const add1 = (x: number) => x + 1;
  const double = (x: number) => x * 2;
  console.log(compose<number>(add1, double)(5)); // 11
  console.log(pipe<number>(add1, double)(5));   // 12
}
