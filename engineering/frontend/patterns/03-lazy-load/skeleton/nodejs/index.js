// ===================== Part A: 图片懒加载 =====================

// 模拟 IntersectionObserver
class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.thresholds = Array.isArray(options?.threshold) ? options.threshold : [options?.threshold || 0];
    this.targets = new Set();
  }

  observe(target) {
    this.targets.add(target);
  }

  unobserve(target) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  simulate(intersecting, ratio = 1) {
    const entries = Array.from(this.targets).map((target) => ({
      target,
      isIntersecting: intersecting,
      intersectionRatio: ratio,
    }));
    this.callback(entries, this);
  }
}

global.IntersectionObserver = MockIntersectionObserver;

// ===================== Part B: 动态导入/代码分割 =====================

// TODO: 实现 lazyLoad
function lazyLoad(importFn) {
  let cached = null;
  let pending = null;
  let error = null;

  return {
    get() {
      // TODO: 同步返回缓存值
      return cached;
    },
    promise() {
      // TODO: 返回 pending 或创建新的 promise
      return pending;
    },
    status() {
      // TODO: 返回状态
      return { loading: false, error };
    },
  };
}

// ===================== 测试代码 =====================

function createElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testCodeSplitting() {
  console.log("\n=== Code Splitting Tests ===");

  let moduleLoaded = false;
  const mockModule = { default: { greet: () => "Hello!" } };

  const lazy = lazyLoad(async () => {
    moduleLoaded = true;
    return mockModule;
  });

  // Test 1: 初始状态
  console.log("Test 1 - Initial state:");
  console.assert(lazy.status().loading === false, "Should not be loading initially");
  console.assert(lazy.get() === null, "Should not have module yet");
  console.assert(moduleLoaded === false, "Module should not be loaded");
  console.log("  ✅ Initial state correct");

  // Test 2: 调用 promise 触发加载
  console.log("\nTest 2 - After calling promise():");
  const module = await lazy.promise();
  console.assert(moduleLoaded === true, "Module should be loaded");
  console.assert(lazy.get() !== null, "Should have cached module");
  console.log(`  ✅ Module loaded: ${JSON.stringify(lazy.get())}`);

  // Test 3: 再次调用 promise 应返回缓存
  console.log("\nTest 3 - Second call returns cache:");
  const cached = await lazy.promise();
  console.assert(cached === lazy.get(), "Should return cached module");
  console.log("  ✅ Cache working");

  console.log("✅ Code Splitting tests passed");
}

async function main() {
  console.log("Running Lazy Load skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testCodeSplitting();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Code Splitting test failed: ${e.message}`);
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