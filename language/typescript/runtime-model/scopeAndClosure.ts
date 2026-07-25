/**
 * 手写 scope and closure 演示
 *
 * 考点：
 * - 词法作用域：函数定义时确定作用域链。
 * - 闭包：函数记住并访问定义时的词法环境。
 * - IIFE / 模块模式。
 */

export function createCounter(): { increment: () => number; get: () => number } {
  let count = 0;
  return {
    increment: () => ++count,
    get: () => count,
  };
}

export function makeMultiplier(factor: number): (x: number) => number {
  return (x) => x * factor;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const counter = createCounter();
  console.log(counter.increment()); // 1
  console.log(counter.increment()); // 2

  const triple = makeMultiplier(3);
  console.log(triple(5)); // 15
}
