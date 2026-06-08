// 事件发布订阅系统 - Node.js 版本

class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  // TODO: on
  on(event, listener) {
    // TODO:
    return () => {};
  }

  // TODO: once
  once(event, listener) {
    // TODO:
    return () => {};
  }

  // TODO: emit
  emit(event, ...args) {
    // TODO:
  }

  // TODO: off
  off(event, listener) {
    // TODO:
  }

  // TODO: removeAllListeners
  removeAllListeners(event) {
    // TODO:
  }

  listenerCount(event) {
    return this.events.get(event)?.size || 0;
  }
}

// ===================== 测试代码 =====================

async function testEventEmitter() {
  console.log("\n=== EventEmitter Tests ===");

  const emitter = new EventEmitter();
  let count = 0;

  // Test 1: 基本订阅/发布
  console.log("\nTest 1 - Basic on/emit:");
  const unsub = emitter.on("click", (x) => { count += x; });
  emitter.emit("click", 1);
  emitter.emit("click", 2);
  console.log(`  count = ${count} (expected 3)`);
  console.assert(count === 3, `Expected 3, got ${count}`);
  console.log("  ✅ Basic on/emit works");

  // Test 2: once
  console.log("\nTest 2 - once:");
  let onceCount = 0;
  emitter.once("once", () => { onceCount++; });
  emitter.emit("once");
  emitter.emit("once");
  console.log(`  onceCount = ${onceCount} (expected 1)`);
  console.assert(onceCount === 1, `Expected 1, got ${onceCount}`);
  console.log("  ✅ once works");

  // Test 3: unsubscribe
  console.log("\nTest 3 - unsubscribe:");
  count = 0;
  unsub();
  emitter.emit("click", 10);
  console.log(`  count = ${count} (expected 0)`);
  console.assert(count === 0, `Expected 0, got ${count}`);
  console.log("  ✅ unsubscribe works");

  // Test 4: off
  console.log("\nTest 4 - off:");
  const listener = () => { count++; };
  emitter.on("off", listener);
  emitter.emit("off");
  emitter.off("off", listener);
  emitter.emit("off");
  console.log(`  count = ${count} (expected 1)`);
  console.assert(count === 1, `Expected 1, got ${count}`);
  console.log("  ✅ off works");

  console.log("\n✅ EventEmitter tests passed");
}

async function main() {
  console.log("Running EventEmitter skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testEventEmitter();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ EventEmitter test failed: ${e.message}`);
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