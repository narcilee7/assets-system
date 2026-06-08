// 防抖函数 - 多次触发合并为一次
// options.leading = true 表示首次触发立即执行
// options.maxWait  表示最大等待时间（debounce专用）
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options?: { leading?: boolean; maxWait?: number }
): T & { cancel: () => void; flush: (...args: Parameters<T>) => void } {
  // TODO: 实现 debounce
  // 提示：
  // 1. 通过闭包保存 timer 和最后一次调用参数
  // 2. 首次触发时根据 leading 选项决定是否立即执行
  // 3. 每次调用都重置 timer
  // 4. 返回的函数需要暴露 cancel() 和 flush() 方法
  // 5. 可选支持 maxWait：即使不断触发，超过 maxWait 也必须执行一次

  return (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastThis: any = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;
    let lastCallTime: number | null = null;

    const invoke = () => {
      if (lastArgs) {
        fn.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    };

    const debounced = function (this: any, ...args: Parameters<T>) {
      lastArgs = args;
      lastThis = this;
      lastCallTime = Date.now();

      // TODO: 处理 maxWait
      // if (options?.maxWait !== undefined) {
      // }

      // TODO: 处理 leading
      // if (options?.leading && !timer) {
      // }

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // TODO: 非 leading 模式下，timer 到期才执行
        invoke();
        timer = null;
        if (maxTimer) {
          clearTimeout(maxTimer);
          maxTimer = null;
        }
      }, wait);
    } as T & { cancel: () => void; flush: (...args: Parameters<T>) => void };

    debounced.cancel = () => {
      if (timer) clearTimeout(timer);
      if (maxTimer) clearTimeout(maxTimer);
      timer = null;
      maxTimer = null;
      lastArgs = null;
    };

    debounced.flush = (...args: Parameters<T>) => {
      debounced.cancel();
      if (args.length > 0) {
        fn.apply(lastThis || this, args);
      } else if (lastArgs) {
        invoke();
      }
    };

    return debounced;
  })();
}

// 节流函数 - 限制执行频率
// options.leading = true  表示首次触发立即执行（默认）
// options.trailing = true 表示最后一次触发会执行（默认）
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean }
): T & { cancel: () => void } {
  // TODO: 实现 throttle
  // 提示：
  // 1. 通过闭包保存 lastTime（上次执行时间）
  // 2. 每次调用计算 Date.now() - lastTime，决定是否执行
  // 3. trailing 为 false 时，窗口末尾的触发会被丢弃
  // 4. leading 为 false 时，首次触发不会立即执行

  return (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastThis: any = null;

    const invoke = () => {
      if (lastArgs) {
        fn.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    };

    const throttled = function (this: any, ...args: Parameters<T>) {
      const now = Date.now();
      const leading = options?.leading !== false;
      const trailing = options?.trailing !== false;
      lastArgs = args;
      lastThis = this;

      // TODO: 实现节流逻辑
      // 1. 如果没有设置 leading，且没有 lastTime，说明是首次调用
      // 2. 如果距离上次执行已超过 wait，执行并更新 lastTime
      // 3. 否则，设置 timer 在剩余时间后执行

      if (leading && !timer) {
        invoke();
      }

      if (!timer) {
        timer = setTimeout(() => {
          if (trailing && lastArgs) {
            invoke();
          }
          timer = null;
        }, wait);
      }
    } as T & { cancel: () => void };

    throttled.cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      lastArgs = null;
    };

    return throttled;
  })();
}

// ===================== 测试代码 =====================

import { EventEmitter } from "events";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function testDebounce() {
  console.log("\n=== Debounce Tests ===");
  const emitter = new EventEmitter();
  let callCount = 0;
  let lastValue = 0;

  const debouncedFn = debounce((value: number) => {
    callCount++;
    lastValue = value;
  }, 100);

  emitter.on("event", debouncedFn);

  // Test 1: 快速触发多次
  emitter.emit("event", 1);
  emitter.emit("event", 2);
  emitter.emit("event", 3);
  await sleep(150);
  console.log(`Test 1 - Rapid triggers: callCount=${callCount}, lastValue=${lastValue}`);
  console.assert(callCount === 1, `Expected callCount=1, got ${callCount}`);
  console.assert(lastValue === 3, `Expected lastValue=3, got ${lastValue}`);

  // Test 2: cancel
  callCount = 0;
  debouncedFn.cancel();
  emitter.emit("event", 10);
  await sleep(50);
  debouncedFn.cancel();
  await sleep(100);
  console.log(`Test 2 - After cancel: callCount=${callCount}`);
  console.assert(callCount === 0, `Expected callCount=0 after cancel, got ${callCount}`);

  // Test 3: flush
  callCount = 0;
  emitter.emit("event", 20);
  emitter.emit("event", 21);
  debouncedFn.flush();
  console.log(`Test 3 - After flush: callCount=${callCount}, lastValue=${lastValue}`);
  console.assert(callCount === 1, `Expected callCount=1 after flush, got ${callCount}`);
  console.assert(lastValue === 21, `Expected lastValue=21 after flush, got ${lastValue}`);

  console.log("✅ Debounce tests passed");
}

async function testThrottle() {
  console.log("\n=== Throttle Tests ===");
  const emitter = new EventEmitter();
  let callCount = 0;
  let lastValue = 0;

  const throttledFn = throttle((value: number) => {
    callCount++;
    lastValue = value;
  }, 50);

  emitter.on("event", throttledFn);

  // Test 1: 首次触发立即执行
  emitter.emit("event", 1);
  console.log(`Test 1 - Immediate: callCount=${callCount}, lastValue=${lastValue}`);
  console.assert(callCount === 1, `Expected immediate call, got ${callCount}`);
  console.assert(lastValue === 1, `Expected lastValue=1, got ${lastValue}`);

  // Test 2: 窗口内后续触发被忽略
  emitter.emit("event", 2);
  emitter.emit("event", 3);
  console.log(`Test 2 - Within window: callCount=${callCount}`);
  console.assert(callCount === 1, `Expected only 1 call within window, got ${callCount}`);

  // Test 3: 超过等待时间后再次触发
  await sleep(60);
  emitter.emit("event", 4);
  console.log(`Test 3 - After wait: callCount=${callCount}, lastValue=${lastValue}`);
  console.assert(callCount === 2, `Expected 2 calls, got ${callCount}`);
  console.assert(lastValue === 4, `Expected lastValue=4, got ${lastValue}`);

  console.log("✅ Throttle tests passed");
}

async function main() {
  console.log("Running Debounce & Throttle skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testDebounce();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`❌ Debounce test failed: ${e.message}`);
  }

  try {
    await testThrottle();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`❌ Throttle test failed: ${e.message}`);
  }

  console.log(`\n${"=".repeat(50)}`);
  if (failed === 0) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${passed})`);
  } else {
    console.log(`❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
}

main();