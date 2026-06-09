// ============================================================
// Vue 3 响应式原理手写
//
// 核心问题：
// 1. Proxy 如何拦截 get/set？
// 2. effect 执行时如何自动收集依赖？
// 3. 依赖变化时如何触发更新？
// ============================================================

// ===================== 依赖图结构 =====================
// WeakMap<target, Map<key, Set<effect>>>
let activeEffect = null;
const targetMap = new WeakMap();

// TODO: track - 收集依赖
// 在 effect 执行期间，读取某个 key 时自动调用
function track(target, key) {
  // TODO:
  // 1. 如果没有 activeEffect，说明不在 effect 执行期间，不需要收集依赖
  // 2. 获取 target 对应的 depsMap（key -> Set<effect>）
  //    - 如果没有，创建一个新的 Map 并存入 targetMap
  // 3. 获取 key 对应的 effect Set
  //    - 如果没有，创建一个新的 Set
  // 4. 将 activeEffect 加入这个 Set
}

// TODO: trigger - 触发更新
// 当某个 key 的值改变时调用
function trigger(target, key) {
  // TODO:
  // 1. 获取 target 对应的 depsMap
  // 2. 获取 key 对应的所有 effect
  // 3. 依次执行每个 effect
  // 注意：如果 effect 执行期间又修改了同一个 key，需要处理（避免循环）
}

// TODO: reactive - 将对象转换为响应式代理
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      // TODO: 调用 track(target, key) 收集依赖
      track(target, key);
      // 如果是对象，递归转换为响应式
      if (result !== null && typeof result === 'object') {
        return reactive(result);
      }
      return result;
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const result = Reflect.set(target, key, value, receiver);
      // TODO: 如果值真的改变了，调用 trigger(target, key)
      if (oldValue !== value) {
        // trigger(target, key);
      }
      return result;
    },
    deleteProperty(target, key) {
      const oldValue = Reflect.get(target, key);
      const result = Reflect.deleteProperty(target, key);
      if (result && oldValue !== undefined) {
        // trigger(target, key);
      }
      return result;
    },
  });
}

// TODO: effect - 创建副作用
// effect 执行时自动收集它访问的所有 key 的依赖
function effect(fn) {
  // TODO:
  // 1. 保存当前的 activeEffect
  // 2. 设置 activeEffect = fn
  // 3. 执行 fn（这会触发 Proxy 的 get，进入 track）
  // 4. 恢复 activeEffect = 之前的值
  // 5. 返回 runner 函数（可手动重新执行）

  fn(); // 直接执行（缺少依赖收集逻辑）
}

// TODO: ref - 创建一个响应式的引用
function ref(value) {
  return {
    get value() {
      // TODO: track
      return value;
    },
    set value(newValue) {
      value = newValue;
      // TODO: trigger
    },
  };
}

// TODO: computed - 创建计算属性
function computed(fn) {
  let dirty = true;
  let cachedValue;

  const runner = effect(() => {
    cachedValue = fn();
    dirty = false;
  });

  return {
    get value() {
      if (dirty) {
        // TODO: 重新执行 fn
        dirty = false;
      }
      return cachedValue;
    },
  };
}

// ===================== 工具函数 =====================

function isReactive(obj) {
  // TODO: 判断是否是响应式对象
  return false;
}

function toRaw(obj) {
  // TODO: 获取原始对象（去除响应式代理）
  return obj;
}

// ===================== 测试 =====================

async function testReactivity() {
  console.log('\n=== Vue Reactivity Tests ===');

  let logs = [];

  // Test 1: 基本响应式
  console.log('\nTest 1 - Basic reactivity:');
  logs = [];
  const state = reactive({ count: 0, name: 'Alice' });

  effect(() => {
    logs.push(`count is ${state.count}`);
  });

  console.log(`  After first effect: ${JSON.stringify(logs)}`);
  console.assert(logs.length === 1, 'Should have 1 log');
  console.assert(logs[0] === 'count is 0', 'Should log initial count');
  console.log('  ✅ Initial effect runs');

  // Test 2: 修改触发 effect
  console.log('\nTest 2 - Modification triggers effect:');
  logs = [];
  state.count = 5;
  console.log(`  After count=5: ${JSON.stringify(logs)}`);
  console.log('  ⚠️  Test 2 pending (TODO not filled)');

  // Test 3: 不相关的 key 不触发 effect
  console.log('\nTest 3 - Unrelated key does not trigger:');
  logs = [];
  state.name = 'Bob';
  console.log(`  After name=Bob: ${JSON.stringify(logs)}`);
  console.log('  ⚠️  Test 3 pending (TODO not filled)');

  // Test 4: 嵌套对象
  console.log('\nTest 4 - Nested reactivity:');
  logs = [];
  const nested = reactive({
    outer: {
      inner: { value: 0 }
    }
  });

  effect(() => {
    logs.push(`inner value is ${nested.outer.inner.value}`);
  });

  console.log(`  Initial: ${JSON.stringify(logs)}`);
  nested.outer.inner.value = 42;
  console.log(`  After change: ${JSON.stringify(logs)}`);
  console.log('  ⚠️  Test 4 pending (TODO not filled)');

  // Test 5: isReactive
  console.log('\nTest 5 - isReactive:');
  console.log(`  isReactive(state) = ${isReactive(state)}`);
  console.log(`  isReactive({}) = ${isReactive({})}`);
  console.log('  ⚠️  Test 5 pending (TODO not filled)');

  console.log('\n✅ Vue Reactivity tests completed');
}

async function main() {
  console.log('Running Vue Reactivity skeleton tests...\n');

  let passed = 0;
  let failed = 0;

  try {
    await testReactivity();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Reactivity test failed: ${e.message}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  if (failed === 0) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${passed})`);
  } else {
    console.log(`❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
}

main();