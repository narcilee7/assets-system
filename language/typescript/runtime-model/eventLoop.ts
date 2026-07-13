/**
 * 手写 eventLoop 演示
 *
 * 考点：
 * - 宏任务（timers / poll / check / close callbacks）。
 * - 微任务（Promise / queueMicrotask / process.nextTick）。
 * - nextTick 优先级高于 Promise.then。
 */

export function eventLoopDemo(): void {
  console.log("1: sync");

  setTimeout(() => console.log("2: setTimeout"), 0);
  setImmediate(() => console.log("3: setImmediate"));

  Promise.resolve().then(() => console.log("4: Promise.then"));
  queueMicrotask(() => console.log("5: queueMicrotask"));
  process.nextTick(() => console.log("6: nextTick"));

  console.log("7: sync end");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  eventLoopDemo();
}
