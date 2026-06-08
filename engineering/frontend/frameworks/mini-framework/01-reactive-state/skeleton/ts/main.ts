// 响应式状态系统

// ===================== 依赖图结构 =====================
// WeakMap<object, Map<key, Set<effect>>>
type Effect = () => void;

const targetMap = new WeakMap<object, Map<string | symbol, Set<Effect>>>();
let activeEffect: Effect | null = null;

// TODO: track - 收集依赖
// 当 effect 执行时，读取某个 key 的值，自动订阅该 key
function track(target: object, key: string | symbol): void {
  // TODO:
  // 1. 如果没有 activeEffect，直接返回（不在 effect 内，不需要收集依赖）
  // 2. 获取 target 对应的 key -> Set<Effect> map（没有则创建）
  // 3. 将 activeEffect 添加到 key 对应的 Set 中
}

// TODO: trigger - 触发更新
// 当某个 key 的值改变时，通知所有订阅的 effect
function trigger(target: object, key: string | symbol): void {
  // TODO:
  // 1. 获取 target 对应的 map
  // 2. 获取 key 对应的 Set<Effect>
  // 3. 依次执行所有 effect
}

// TODO: reactive - 将对象转换为响应式代理
function reactive<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      // TODO: track(target, key) 收集依赖
      // 注意：如果是对象，需要递归包装为响应式
      return typeof result === 'object' && result !== null
        ? reactive(result)
        : result;
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const result = Reflect.set(target, key, value, receiver);
      // TODO: 如果值真的改变了，trigger(target, key)
      if (oldValue !== value) {
        // trigger(target, key);
      }
      return result;
    },
  });
}

// TODO: createEffect - 创建副作用
// 在 effect 函数执行期间，自动收集它读取的 key 的依赖
function createEffect(effect: Effect): void {
  // TODO:
  // 1. 保存当前的 activeEffect
  // 2. 设置 activeEffect = effect
  // 3. 执行 effect
  // 4. 恢复 activeEffect
  effect(); // 这行需要替换为上述逻辑
}

// ===================== 测试代码 =====================

async function testReactive() {
  console.log("\n=== Reactive State Tests ===");

  // Test 1: 基本响应式
  console.log("\nTest 1 - Basic reactivity:");
  const logs: string[] = [];
  const state = reactive({ count: 0, name: "Alice" });

  createEffect(() => {
    logs.push(`count is ${state.count}`);
  });

  console.log(`  After first effect: ${JSON.stringify(logs)}`);
  console.assert(logs.length === 1, "Should have 1 log");
  console.assert(logs[0] === "count is 0", "Should log initial count");

  // Test 2: 修改触发 effect
  console.log("\nTest 2 - Modification triggers effect:");
  logs.length = 0;
  state.count = 5;
  console.log(`  After count=5: ${JSON.stringify(logs)}`);
  // TODO: 取消注释后应该通过
  // console.assert(logs.length === 1, "Should trigger effect");
  // console.assert(logs[0] === "count is 5", "Should log new count");

  // Test 3: 不相关的 key 不触发 effect
  console.log("\nTest 3 - Unrelated key doesn't trigger:");
  logs.length = 0;
  state.name = "Bob";
  console.log(`  After name=Bob: ${JSON.stringify(logs)}`);
  // TODO: 应该为空，因为 effect 只订阅了 count
  // console.assert(logs.length === 0, "Should not trigger");

  // Test 4: 嵌套对象
  console.log("\nTest 4 - Nested reactivity:");
  logs.length = 0;
  const nested = reactive({
    outer: {
      inner: { value: 0 }
    }
  });
  createEffect(() => {
    logs.push(`inner value is ${nested.outer.inner.value}`);
  });
  console.log(`  Initial: ${JSON.stringify(logs)}`);
  nested.outer.inner.value = 42;
  console.log(`  After change: ${JSON.stringify(logs)}`);
  // TODO: 嵌套对象的修改也应该触发 effect
  // console.assert(logs.length === 2, "Should trigger for nested change");

  console.log("\n✅ Reactive State tests completed");
}

async function main() {
  console.log("Running Reactive State skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testReactive();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`❌ Reactive State test failed: ${e.message}`);
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