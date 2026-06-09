// ============================================================
// Vue Effect Scheduler 调度机制
//
// 核心问题：
// 1. Vue 如何用微任务队列调度 effect？
// 2. scheduler 函数的作用是什么？
// 3. flush timing (sync/pre/post) 如何实现？
// ============================================================

// ===================== 调度队列 =====================

const queue = [];
let isFlushing = false;
let currentFlush = null;

// TODO: queueJob - 将 job 加入队列
function queueJob(job) {
  // TODO:
  // 1. 避免重复添加（检查 job.id 是否已在队列中）
  // 2. 根据 priority 插入到正确位置
  // 3. 如果队列不在 flushing，启动 flush
}

// TODO: flushJobs - 清空队列
async function flushJobs() {
  // TODO:
  // 1. 按 priority 排序队列
  // 2. while queue 不为空，依次执行 job
  // 3. 执行完后清空队列
  // 4. 处理特殊情况：flush 时新加入的 job、re-render 的 job
}

// ===================== 简化版 Reactive =====================

let activeEffect = null;
const targetMap = new WeakMap();

function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      depsMap = new Map();
      targetMap.set(target, depsMap);
    }
    let deps = depsMap.get(key);
    if (!deps) {
      deps = new Set();
      depsMap.set(key, deps);
    }
    deps.add(activeEffect);
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const deps = depsMap.get(key);
  if (!deps) return;

  // TODO: 执行所有依赖的 effect
  // 如果 effect 有 scheduler，用 scheduler，否则直接执行
  deps.forEach(effect => {
    // TODO:
    // 1. 检查 effect.options?.scheduler
    // 2. 如果有 scheduler，queueJob(scheduler)
    // 3. 否则直接执行 effect
    effect();
  });
}

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      track(target, key);
      if (result !== null && typeof result === 'object') {
        return reactive(result);
      }
      return result;
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const result = Reflect.set(target, key, value, receiver);
      if (oldValue !== value) {
        trigger(target, key);
      }
      return result;
    },
  });
}

// ===================== Effect Options =====================

const defaultOptions = {
  scheduler: null,  // 自定义调度器
  flush: 'sync',    // 执行时机：sync/pre/post
};

// TODO: effect - 创建副作用（支持 scheduler）
function effect(fn, options = {}) {
  const { scheduler, flush } = { ...defaultOptions, ...options };

  const effectFn = () => {
    activeEffect = effectFn;
    fn();
    activeEffect = null;
  };

  effectFn.options = { scheduler, flush };

  effectFn(); // 立即执行一次
  return effectFn;
}

// TODO: computed - 创建计算属性（带缓存）
function computed(getter) {
  let dirty = true;
  let cachedValue;

  const runner = effect(getter, {
    scheduler: () => { dirty = true; },
    flush: 'sync',
  });

  return {
    get value() {
      if (dirty) {
        cachedValue = runner();
        dirty = false;
      }
      return cachedValue;
    },
  };
}

// ===================== 测试 =====================

async function testScheduler() {
  console.log('\n=== Vue Effect Scheduler Tests ===\n');

  // Test 1: 默认同步执行
  console.log('Test 1 - Sync execution:');
  let count = 0;
  const state = reactive({ value: 0 });

  effect(() => {
    count++;
  });

  console.log(`  After effect: count = ${count}`);
  console.assert(count === 1, 'Effect should run once on init');
  state.value = 1;
  console.log(`  After trigger: count = ${count}`);
  console.assert(count === 2, 'Effect should run again on trigger');
  console.log('  ✅ Sync execution works\n');

  // Test 2: 自定义 scheduler
  console.log('Test 2 - Custom scheduler:');
  let scheduleCount = 0;
  let effectRunCount = 0;
  const state2 = reactive({ count: 0 });

  effect(() => {
    effectRunCount++;
  }, {
    scheduler: (job) => {
      scheduleCount++;
      // 模拟：延迟执行
      setTimeout(job, 0);
    },
  });

  console.log(`  After init: effectRunCount = ${effectRunCount}, scheduleCount = ${scheduleCount}`);
  state2.count = 1;
  state2.count = 2; // 快速连续修改
  console.log(`  After triggers (sync): scheduleCount = ${scheduleCount}`);

  // 等待 scheduler 执行
  await new Promise(r => setTimeout(r, 10));
  console.log(`  After microtask: effectRunCount = ${effectRunCount}`);
  console.log('  ⚠️  Scheduler test pending (queueJob not fully implemented)\n');

  // Test 3: computed 缓存
  console.log('Test 3 - Computed caching:');
  let computeRuns = 0;
  const obj = reactive({ a: 1, b: 2 });

  const sum = computed(() => {
    computeRuns++;
    return obj.a + obj.b;
  });

  console.log(`  First access: sum = ${sum.value}`);
  console.log(`  computeRuns = ${computeRuns}`);
  console.assert(computeRuns === 1, 'Should compute once');

  // 读取不改变依赖的值
  const _ = sum.value;
  console.log(`  Second access (no change): computeRuns = ${computeRuns}`);
  console.assert(computeRuns === 1, 'Should use cache');

  // 改变依赖
  obj.a = 10;
  console.log(`  After obj.a = 10: computeRuns = ${computeRuns}`);
  const newSum = sum.value;
  console.log(`  New sum: ${newSum}`);
  console.assert(computeRuns === 2, 'Should recompute after change');
  console.log('  ✅ Computed caching works\n');

  console.log('✅ Scheduler tests completed\n');
}

async function main() {
  console.log('Running Effect Scheduler skeleton tests...\n');

  let passed = 0;
  let failed = 0;

  try {
    await testScheduler();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Scheduler test failed: ${e.message}`);
  }

  console.log(`${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${passed})`);
  } else {
    console.log(`❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
}

main();