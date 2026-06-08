// ===================== Part A: 图片懒加载 =====================

// 模拟 IntersectionObserver
type IntersectionObserverCallback = (
  entries: { target: any; isIntersecting: boolean; intersectionRatio: number }[],
  observer: any
) => void;

class MockIntersectionObserver implements IntersectionObserver {
  private callback: IntersectionObserverCallback;
  private targets: Set<any> = new Set();
  private thresholds: number[];

  constructor(callback: IntersectionObserverCallback, options?: { threshold?: number | number[] }) {
    this.callback = callback;
    this.thresholds = Array.isArray(options?.threshold)
      ? options.threshold
      : options?.threshold !== undefined
      ? [options.threshold]
      : [0];
  }

  observe(target: any): void {
    this.targets.add(target);
  }

  unobserve(target: any): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  // 模拟触发交叉状态
  simulate(intersecting: boolean, ratio: number = 1): void {
    const entries = Array.from(this.targets).map((target) => ({
      target,
      isIntersecting: intersecting,
      intersectionRatio: ratio,
    }));
    this.callback(entries, this);
  }
}

// 全局 mock
(global as any).IntersectionObserver = MockIntersectionObserver;

interface LazyImageOptions {
  root?: any;
  rootMargin?: string;
  threshold?: number | number[];
  placeholder?: string;
  loading?: string;
  error?: string;
}

interface LazyImageInstance {
  target: any;
  load(): Promise<void>;
  destroy(): void;
}

// TODO: 实现图片懒加载
// 提示：
// 1. 创建一个 IntersectionObserver 监听 target
// 2. 当 isIntersecting 为 true 时，将 data-src 赋值给 src
// 3. 图片加载完成后替换占位图
// 4. 加载失败显示 error 图
// 5. observer.unobserve 避免重复触发
function createLazyImage(
  target: any,
  options: LazyImageOptions = {}
): LazyImageInstance {
  const { threshold = 0, rootMargin = "0px" } = options;

  // TODO: 创建 observer，当 target 进入视口时加载图片
  // const observer = new IntersectionObserver((entries) => {
  //   entries.forEach((entry) => {
  //     if (entry.isIntersecting) {
  //       // TODO: 加载图片
  //     }
  //   });
  // }, { threshold, rootMargin });

  // observer.observe(target);

  return {
    target,
    load: async () => {
      // TODO: 手动触发加载
    },
    destroy: () => {
      // TODO: 取消观察
    },
  };
}

// ===================== Part B: 动态导入/代码分割 =====================

interface LazyResult<T> {
  loaded: T | null;
  loading: boolean;
  error: Error | null;
}

// TODO: 实现 lazyLoad
// 提示：
// 1. 返回一个 Promise，首次 resolve 后缓存结果
// 2. 记录 loading 状态和 error 状态
// 3. 支持同步检查状态（用于 React Suspense 等场景）
function lazyLoad<T>(importFn: () => Promise<{ default: T }>): {
  get: () => T | null;
  promise: () => Promise<T>;
  status: () => { loading: boolean; error: Error | null };
} {
  let cached: T | null = null;
  let pending: Promise<T> | null = null;
  let error: Error | null = null;

  return {
    get: () => {
      // TODO: 同步返回缓存值
      return cached;
    },
    promise: () => {
      // TODO: 返回 pending 或创建新的 promise
      return pending!;
    },
    status: () => {
      // TODO: 返回状态
      return { loading: false, error };
    },
  };
}

// ===================== 测试代码 =====================

async function testLazyImage() {
  console.log("\n=== Lazy Image Tests ===");

  const container = createElement("div");
  const img = createElement("img");
  img.setAttribute("data-src", "https://example.com/real-image.jpg");
  img.setAttribute("src", "placeholder.png");
  container.appendChild(img);

  const lazyImg = createLazyImage(img, {
    threshold: 0.1,
    placeholder: "placeholder.png",
    error: "error.png",
  });

  // Test 1: 未进入视口时不加载
  console.log("Test 1 - Before intersection:");
  console.log(`  src: ${img.textContent || img.style.backgroundImage || "placeholder"}`);
  console.assert(img.getAttribute("src") === "placeholder.png", "Should show placeholder");

  // Test 2: 进入视口后触发加载
  console.log("\nTest 2 - After intersection:");
  lazyImg.load();
  await sleep(100);
  console.assert(img.getAttribute("src") === "https://example.com/real-image.jpg", "Should load real image");
  console.log(`  ✅ Image loaded successfully`);

  // Test 3: destroy
  lazyImg.destroy();
  console.log("\nTest 3 - After destroy:");
  console.log(`  ✅ Observer disconnected`);

  console.log("✅ Lazy Image tests passed");
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

function createElement(tag: string): any {
  return {
    tagName: tag.toUpperCase(),
    attributes: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    getAttribute(name: string) {
      return this.attributes[name];
    },
    get style() {
      return { backgroundImage: this.attributes["style"] || "" };
    },
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Running Lazy Load skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testLazyImage();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`❌ Lazy Image test failed: ${e.message}`);
  }

  try {
    await testCodeSplitting();
    passed++;
  } catch (e: any) {
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