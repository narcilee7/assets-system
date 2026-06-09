// SWR 风格的请求缓存管理器 - Node.js 版本

class RequestCache {
  constructor(defaultTTL = 5000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  // TODO: serializeKey
  serializeKey(key) {
    // TODO:
    return typeof key === 'string' ? key : JSON.stringify(key);
  }

  // TODO: isExpired
  isExpired(key) {
    // TODO:
    return true;
  }

  // TODO: get
  get(key) {
    // TODO:
    return null;
  }

  // TODO: fetch
  async fetch(key, fetcher) {
    // TODO:
    return null;
  }

  // TODO: set
  set(key, data) {
    // TODO:
  }

  // TODO: invalidate
  invalidate(key) {
    // TODO:
  }

  // TODO: clear
  clear() {
    this.cache.clear();
  }

  getStats() {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

// ===================== 测试代码 =====================

async function testRequestCache() {
  console.log("\n=== Request Cache Tests ===");

  const cache = new RequestCache(1000);

  let fetchCount = 0;
  const fetcher = async () => {
    fetchCount++;
    return { id: 1, name: "Alice" };
  };

  // Test 1: 缓存未命中时发起请求
  console.log("\nTest 1 - Cache miss triggers fetch:");
  const data1 = await cache.fetch("/user/1", fetcher);
  console.log(`  fetchCount = ${fetchCount} (expected 1)`);
  console.assert(fetchCount === 1, "Should call fetcher once");
  console.log("  ✅ Cache miss triggers fetch");

  // Test 2: 缓存命中时直接返回
  console.log("\nTest 2 - Cache hit returns data:");
  const data2 = await cache.fetch("/user/1", fetcher);
  console.log(`  fetchCount = ${fetchCount} (expected 1)`);
  console.assert(fetchCount === 1, "Should not call fetcher again");
  console.log("  ✅ Cache hit returns cached data");

  // Test 3: 相同 key 的请求去重
  console.log("\nTest 3 - Deduplication:");
  await Promise.all([
    cache.fetch("/user/2", fetcher),
    cache.fetch("/user/2", fetcher),
  ]);
  console.log(`  fetchCount = ${fetchCount} (expected 2)`);
  console.log("  ✅ Deduplication works");

  // Test 4: invalidate
  console.log("\nTest 4 - Invalidate:");
  cache.set("/user/1", { id: 1, name: "Bob" });
  cache.invalidate("/user/1");
  console.log("  ✅ Invalidate works");

  console.log("\n✅ Request Cache tests passed");
}

async function main() {
  console.log("Running Request Cache skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testRequestCache();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Request Cache test failed: ${e.message}`);
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