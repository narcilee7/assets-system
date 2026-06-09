// 事件发布订阅系统

type Listener = (...args: any[]) => void;

class EventEmitter {
  private events: Map<string, Set<Listener>> = new Map();

  // TODO: on - 订阅事件
  on(event: string, listener: Listener): () => void {
    // TODO:
    // 1. 获取或创建 event 对应的 Set
    // 2. 添加 listener 到 Set
    // 3. 返回 unsubscribe 函数
    return () => {};
  }

  // TODO: once - 一次性订阅
  once(event: string, listener: Listener): () => void {
    // TODO:
    // 1. 创建一个包装函数，执行后自动取消订阅
    // 2. 复用 on 方法
    return () => {};
  }

  // TODO: emit - 发布事件
  emit(event: string, ...args: any[]): void {
    // TODO:
    // 1. 获取 event 对应的 listeners
    // 2. 依次调用所有 listener
    // 3. 注意：如果在 listeners 执行过程中添加/删除监听器，不影响本次 emit
  }

  // TODO: off - 取消订阅
  off(event: string, listener: Listener): void {
    // TODO:
    // 1. 获取 event 对应的 Set
    // 2. 删除指定 listener
  }

  // TODO: removeAllListeners - 清除所有订阅
  removeAllListeners(event?: string): void {
    // TODO:
    // 如果传入 event，只清除该事件
    // 否则清除所有事件
  }

  listenerCount(event: string): number {
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
  const unsub = emitter.on("click", (x: number) => { count += x; });
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

  // Test 5: removeAllListeners
  console.log("\nTest 5 - removeAllListeners:");
  emitter.on("a", () => {});
  emitter.on("b", () => {});
  emitter.removeAllListeners("a");
  console.log(`  listenerCount('a') = ${emitter.listenerCount("a")} (expected 0)`);
  console.log(`  listenerCount('b') = ${emitter.listenerCount("b")} (expected 1)`);
  console.assert(emitter.listenerCount("a") === 0, "a should have 0 listeners");
  console.assert(emitter.listenerCount("b") === 1, "b should have 1 listener");
  console.log("  ✅ removeAllListeners works");

  console.log("\n✅ EventEmitter tests passed");
}

async function main() {
  console.log("Running EventEmitter skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testEventEmitter();
    passed++;
  } catch (e: any) {
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