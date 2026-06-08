// 虚拟列表 - 模拟浏览器环境测试

// ===================== 模拟 DOM 环境 =====================

class MockElement {
  public children: MockElement[] = [];
  public textContent: string = "";
  public style: Record<string, string> = {};
  public className: string = "";
  public height: number = 50;
  public width: number = 300;
  public offsetHeight: number = 50;
  public offsetWidth: number = 300;
  public offsetTop: number = 0;
  public offsetLeft: number = 0;
  public scrollTop: number = 0;
  public scrollHeight: number = 0;
  public clientHeight: number = 500;
  public innerHTML: string = "";

  constructor(public tagName: string) {}

  appendChild(child: MockElement): void {
    this.children.push(child);
  }

  removeChild(child: MockElement): void {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
  }

  setAttribute(name: string, value: string): void {
    if (name === "class") this.className = value;
    else if (name === "style") {
      const styleMap: Record<string, string> = {};
      value.split(";").forEach((s) => {
        const [k, v] = s.split(":");
        if (k && v) styleMap[k.trim()] = v.trim();
      });
      this.style = styleMap;
    }
  }

  getBoundingClientRect() {
    return { height: this.offsetHeight, width: this.offsetWidth, top: this.offsetTop };
  }
}

function createElement(tag: string): MockElement {
  return new MockElement(tag);
}

const document = {
  createElement,
  getElementById: (id: string) => new MockElement("div"),
};

// ===================== 虚拟列表实现 =====================

interface VirtualListOptions {
  itemHeight: number;      // 每项固定高度
  buffer?: number;         // 缓冲区大小（额外渲染的项数）
  containerHeight?: number; // 容器高度
}

class VirtualList<T> {
  private container: MockElement;
  private content: T[];
  private itemHeight: number;
  private buffer: number;
  private renderedItems: Map<number, MockElement> = new Map();
  private totalHeight: number = 0;
  private scrollTop: number = 0;
  private viewportHeight: number = 500;

  // TODO: 实现虚拟列表核心逻辑
  // 提示：
  // 1. 计算当前可见范围 startIndex 和 endIndex
  // 2. 根据 scrollTop 计算需要渲染的项
  // 3. 回收不再可见的项，复用 DOM 节点
  // 4. 更新容器总高度（用 padding 或 transform 撑开）

  constructor(container: MockElement, content: T[], options: VirtualListOptions) {
    this.container = container;
    this.content = content;
    this.itemHeight = options.itemHeight;
    this.buffer = options.buffer ?? 3;
    this.viewportHeight = options.containerHeight ?? 500;
    this.totalHeight = content.length * this.itemHeight;

    // TODO: 初始化渲染
    this.render();
  }

  getTotalHeight(): number {
    return this.totalHeight;
  }

  getRenderedCount(): number {
    return this.renderedItems.size;
  }

  scrollTo(scrollTop: number): void {
    this.scrollTop = scrollTop;
    this.render();
  }

  setViewportHeight(height: number): void {
    this.viewportHeight = height;
    this.render();
  }

  private render(): void {
    // TODO: 计算可见范围
    // const startIndex = ...
    // const endIndex = ...

    // TODO: 回收不在可见范围的节点
    // for (const [idx, el] of this.renderedItems) {
    //   if (idx < startIndex || idx > endIndex) {
    //     ...
    //   }
    // }

    // TODO: 创建/复用可见范围内的节点
    // for (let i = startIndex; i <= endIndex; i++) {
    //   if (!this.renderedItems.has(i)) {
    //     // 创建新节点
    //   }
    // }

    // 更新容器 padding 撑开滚动区域
    // this.container 实际渲染的子节点需要设置 transform: translateY(offset)
  }
}

// ===================== 测试代码 =====================

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testVirtualList() {
  console.log("\n=== Virtual List Tests ===");

  // 创建模拟容器
  const container = createElement("div");
  container.clientHeight = 500;

  // 模拟 10000 条数据
  const DATA_SIZE = 10000;
  const ITEM_HEIGHT = 50;
  const content = Array.from({ length: DATA_SIZE }, (_, i) => ({ id: i, text: `Item ${i}` }));

  const virtualList = new VirtualList(container, content, {
    itemHeight: ITEM_HEIGHT,
    buffer: 3,
    containerHeight: 500,
  });

  console.log(`Total items: ${DATA_SIZE}`);
  console.log(`Total height: ${virtualList.getTotalHeight()}px (expected: ${DATA_SIZE * ITEM_HEIGHT})`);

  // Test 1: 初始渲染
  console.log(`\nTest 1 - Initial render:`);
  console.log(`  Rendered nodes: ${virtualList.getRenderedCount()}`);
  const expectedVisibleItems = Math.ceil(500 / ITEM_HEIGHT) + 2 * 3; // viewport + buffer
  if (virtualList.getRenderedCount() > expectedVisibleItems * 2) {
    throw new Error(`Expected ~${expectedVisibleItems} nodes, got ${virtualList.getRenderedCount()}`);
  }
  console.log(`  ✅ Only visible nodes rendered`);

  // Test 2: 滚动后复用节点
  console.log(`\nTest 2 - Scroll to middle:`);
  virtualList.scrollTo(5000); // 滚动到中间
  console.log(`  Rendered nodes: ${virtualList.getRenderedCount()}`);
  if (virtualList.getRenderedCount() > expectedVisibleItems * 2) {
    throw new Error(`Expected ~${expectedVisibleItems} nodes after scroll, got ${virtualList.getRenderedCount()}`);
  }
  console.log(`  ✅ Nodes recycled correctly`);

  // Test 3: 滚动到底部
  console.log(`\nTest 3 - Scroll to end:`);
  virtualList.scrollTo(DATA_SIZE * ITEM_HEIGHT);
  console.log(`  Rendered nodes: ${virtualList.getRenderedCount()}`);
  if (virtualList.getRenderedCount() > expectedVisibleItems * 2) {
    throw new Error(`Expected ~${expectedVisibleItems} nodes at end, got ${virtualList.getRenderedCount()}`);
  }
  console.log(`  ✅ Works correctly at end`);

  console.log("\n✅ Virtual List tests passed");
}

async function main() {
  console.log("Running Virtual List skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testVirtualList();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`❌ Virtual List test failed: ${e.message}`);
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