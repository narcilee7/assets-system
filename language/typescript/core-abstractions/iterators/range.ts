/**
 * 手写 range
 *
 * 考点：
 * - 可迭代协议 Symbol.iterator。
 * - 支持 start / stop / step。
 */

export function* range(start: number, stop?: number, step: number = 1): Generator<number> {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }
  if (step === 0) throw new Error("step must not be zero");

  if (step > 0) {
    for (let i = start; i < stop; i += step) yield i;
  } else {
    for (let i = start; i > stop; i += step) yield i;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log([...range(5)]);        // [0, 1, 2, 3, 4]
  console.log([...range(1, 5)]);     // [1, 2, 3, 4]
  console.log([...range(0, 10, 2)]); // [0, 2, 4, 6, 8]
}
