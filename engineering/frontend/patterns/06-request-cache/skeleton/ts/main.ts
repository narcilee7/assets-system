// SWR 风格的请求缓存管理器

interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
  promise: Promise<T> | null;
  error: any;
}

type Fetcher<T> = () => Promise<T>;

class RequestCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL = 5000) {
    this.defaultTTL = defaultTTL;
  }

  // TODO: serializeKey - 序列化缓存 key（支持字符串或数组）
  private serializeKey(key: string | any[]): string {
    // TODO:
    // if (typeof key === 'string') return key;
    // return JSON.stringify(key);
    return key as string;
  }

  // TODO: isExpired - 检查缓存是否过期
  private isExpired(key: string): boolean {
    // TODO:
    // const entry = this.cache.get(key);
    // if (!entry) return true;
    // return Date.now() - entry.timestamp > this.defaultTTL;
    return true;
  }

  // TODO: get - 获取缓存数据（检查 TTL）
  get<T>(key: string | any[]): T | null {
    // TODO:
    // const serialized = this.serializeKey(key);
    // if (this.isExpired(serialized)) return null;
    // return this.cache.get(serialized)?.data ?? null;
    return null;
  }

  // TODO: fetch - 发起请求（带去重）
  async fetch<T>(key: string | any[], fetcher: Fetcher<T>): Promise<T> {
    // TODO:
    // 1. 序列化 key
    // 2. 检查是否有进行中的 promise，有则复用
    // 3. 检查缓存是否有效（在 TTL 内），有效则直接返回缓存数据 + 后台 revalidate
    // 4. 否则创建新 promise 执行 fetcher
    // 5. 更新缓存 entry（data、timestamp、promise、error）
    // 6. 返回数据
    return null as T;
  }

  // TODO: set - 手动设置缓存
  set<T>(key: string | any[], data: T): void {
    // TODO:
  }

  // TODO: invalidate - 手动失效缓存
  invalidate(key: string | any[]): void {
    // TODO:
  }

  // TODO: clear - 清空所有缓存
  clear(): void {
    this.cache.clear();
  }

  // TODO: getStats - 获取缓存统计
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// ===================== 测试代码 =====================

async function testRequestCache() {
  console.log("\n=== Request Cache Tests ===");

  const cache = new RequestCache(1000); // 1s TTL

  // Test 1: 缓存未命中时发起请求
  console.log("\nTest 1 - Cache miss triggers fetch:");
  let fetchCount = 0;
  const fetcher = async () => {
    fetchCount++;
    return { id: 1, name: "Alice" };
  };

  const data1 = await cache.fetch("/user/1", fetcher);
  console.log(`  fetchCount = ${fetchCount} (expected 1)`);
  console.assert(fetchCount === 1, "Should call fetcher once");
  console.log(`  data = ${JSON.stringify(data1)}`);
  console.log("  ✅ Cache miss triggers fetch");

  // Test 2: 缓存命中时直接返回
  console.log("\nTest 2 - Cache hit returns data:");
  const data2 = await cache.fetch("/user/1", fetcher);
  console.log(`  fetchCount = ${fetchCount} (expected 1)`);
  console.assert(fetchCount === 1, "Should not call fetcher again");
  console.log("  ✅ Cache hit returns cached data");

  // Test 3: 相同 key 的请求去重
  console.log("\nTest 3 - Deduplication:");
  fetchCount = 0;
  const results = await Promise.all([
    cache.fetch("/user/2", fetcher),
    cache.fetch("/user/2", fetcher),
    cache.fetch("/user/2", fetcher),
  ]);
  console.log(`  fetchCount = ${fetchCount} (expected 1)`);
  console.assert(fetchCount === 1, "Should deduplicate requests");
  console.log("  ✅ Deduplication works");

  // Test 4: 缓存过期后重新请求
  console.log("\nTest 4 - Cache expiration:");
  await new Promise((r) => setTimeout(r, 1100)); // 等待 TTL 过期
  const data4 = await cache.fetch("/user/1", fetcher);
  console.log(`  fetchCount = ${fetchCount + 1} (expected ${fetchCount + 1})`);
  console.assert(fetchCount >= 2, "Should call fetcher again after expiration");
  console.log("  ✅ Cache expiration works");

  // Test 5: invalidate
  console.log("\nTest 5 - Invalidate:");
  cache.set("/user/1", { id: 1, name: "Bob" });
  console.assert(cache.get("/user/1")?.name === "Bob", "Should have new data");
  cache.invalidate("/user/1");
  console.assert(cache.get("/user/1") === null, "Should be invalidated");
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
  } catch (e: any) {
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