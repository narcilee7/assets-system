// 防抖函数 - 多次触发合并为一次
// 节流函数 - 限制执行频率
// 运行环境：Node.js（用于验证核心逻辑）

const { EventEmitter } = require("events");

// ===================== 防抖实现 =====================
// TODO: 实现 debounce
function debounce(fn, wait, options) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let maxTimer = null;
  let lastCallTime = null;

  const invoke = () => {
    if (lastArgs) {
      fn.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  };

  const debounced = function (...args) {
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
      invoke();
      timer = null;
      if (maxTimer) {
        clearTimeout(maxTimer);
        maxTimer = null;
      }
    }, wait);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    if (maxTimer) clearTimeout(maxTimer);
    timer = null;
    maxTimer = null;
    lastArgs = null;
  };

  debounced.flush = (...args) => {
    debounced.cancel();
    if (args.length > 0) {
      fn.apply(lastThis || this, args);
    } else if (lastArgs) {
      invoke();
    }
  };

  return debounced;
}

// ===================== 节流实现 =====================
// TODO: 实现 throttle
function throttle(fn, wait, options) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  const invoke = () => {
    if (lastArgs) {
      fn.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  };

  const throttled = function (...args) {
    const leading = options?.leading !== false;
    const trailing = options?.trailing !== false;
    lastArgs = args;
    lastThis = this;

    // TODO: 实现节流逻辑
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
  };

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return throttled;
}

// ===================== 测试代码 =====================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function testDebounce() {
  console.log("\n=== Debounce Tests ===");
  const emitter = new EventEmitter();
  let callCount = 0;
  let lastValue = 0;

  const debouncedFn = debounce((value) => {
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
  if (callCount !== 1) throw new Error(`Expected callCount=1, got ${callCount}`);
  if (lastValue !== 3) throw new Error(`Expected lastValue=3, got ${lastValue}`);

  // Test 2: cancel
  callCount = 0;
  debouncedFn.cancel();
  emitter.emit("event", 10);
  await sleep(50);
  debouncedFn.cancel();
  await sleep(100);
  console.log(`Test 2 - After cancel: callCount=${callCount}`);
  if (callCount !== 0) throw new Error(`Expected callCount=0 after cancel, got ${callCount}`);

  // Test 3: flush
  callCount = 0;
  emitter.emit("event", 20);
  emitter.emit("event", 21);
  debouncedFn.flush();
  console.log(`Test 3 - After flush: callCount=${callCount}, lastValue=${lastValue}`);
  if (callCount !== 1) throw new Error(`Expected callCount=1 after flush, got ${callCount}`);
  if (lastValue !== 21) throw new Error(`Expected lastValue=21 after flush, got ${lastValue}`);

  console.log("✅ Debounce tests passed");
}

async function testThrottle() {
  console.log("\n=== Throttle Tests ===");
  const emitter = new EventEmitter();
  let callCount = 0;
  let lastValue = 0;

  const throttledFn = throttle((value) => {
    callCount++;
    lastValue = value;
  }, 50);

  emitter.on("event", throttledFn);

  // Test 1: 首次触发立即执行
  emitter.emit("event", 1);
  console.log(`Test 1 - Immediate: callCount=${callCount}, lastValue=${lastValue}`);
  if (callCount !== 1) throw new Error(`Expected immediate call, got ${callCount}`);
  if (lastValue !== 1) throw new Error(`Expected lastValue=1, got ${lastValue}`);

  // Test 2: 窗口内后续触发被忽略
  emitter.emit("event", 2);
  emitter.emit("event", 3);
  console.log(`Test 2 - Within window: callCount=${callCount}`);
  if (callCount !== 1) throw new Error(`Expected only 1 call within window, got ${callCount}`);

  // Test 3: 超过等待时间后再次触发
  await sleep(60);
  emitter.emit("event", 4);
  console.log(`Test 3 - After wait: callCount=${callCount}, lastValue=${lastValue}`);
  if (callCount !== 2) throw new Error(`Expected 2 calls, got ${callCount}`);
  if (lastValue !== 4) throw new Error(`Expected lastValue=4, got ${lastValue}`);

  console.log("✅ Throttle tests passed");
}

async function main() {
  console.log("Running Debounce & Throttle skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testDebounce();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Debounce test failed: ${e.message}`);
  }

  try {
    await testThrottle();
    passed++;
  } catch (e) {
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