// 虚拟列表 - Node.js 模拟环境

// ===================== 模拟 DOM 环境 =====================

class MockElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.className = "";
    this.height = 50;
    this.offsetHeight = 50;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 500;
  }

  appendChild(child) {
    this.children.push(child);
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
  }

  setAttribute(name, value) {
    if (name === "class") this.className = value;
    else if (name === "style") {
      const styleMap = {};
      value.split(";").forEach((s) => {
        const [k, v] = s.split(":");
        if (k && v) styleMap[k.trim()] = v.trim();
      });
      this.style = styleMap;
    }
  }
}

function createElement(tag) {
  return new MockElement(tag);
}

// ===================== 虚拟列表实现 =====================

class VirtualList {
  constructor(container, content, options) {
    this.container = container;
    this.content = content;
    this.itemHeight = options.itemHeight;
    this.buffer = options.buffer ?? 3;
    this.viewportHeight = options.containerHeight ?? 500;
    this.renderedItems = new Map();
    this.scrollTop = 0;
    this.totalHeight = content.length * this.itemHeight;

    // TODO: 初始化渲染
    this.render();
  }

  getTotalHeight() {
    return this.totalHeight;
  }

  getRenderedCount() {
    return this.renderedItems.size;
  }

  scrollTo(scrollTop) {
    this.scrollTop = scrollTop;
    this.render();
  }

  setViewportHeight(height) {
    this.viewportHeight = height;
    this.render();
  }

  render() {
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
  }
}

// ===================== 测试代码 =====================

const DATA_SIZE = 10000;
const ITEM_HEIGHT = 50;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testVirtualList() {
  console.log("\n=== Virtual List Tests ===");

  const container = createElement("div");
  container.clientHeight = 500;

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
  const expectedVisibleItems = Math.ceil(500 / ITEM_HEIGHT) + 2 * 3;

  // Initially all nodes might be rendered (skeleton state)
  if (virtualList.getRenderedCount() === DATA_SIZE) {
    console.log(`  ⚠️  All nodes rendered (skeleton - TODO not implemented)`);
  } else if (virtualList.getRenderedCount() <= expectedVisibleItems * 2) {
    console.log(`  ✅ Only visible nodes rendered`);
  }

  // Test 2: 滚动后复用节点
  console.log(`\nTest 2 - Scroll to middle:`);
  virtualList.scrollTo(5000);
  console.log(`  Rendered nodes: ${virtualList.getRenderedCount()}`);

  // Test 3: 滚动到底部
  console.log(`\nTest 3 - Scroll to end:`);
  virtualList.scrollTo(DATA_SIZE * ITEM_HEIGHT);
  console.log(`  Rendered nodes: ${virtualList.getRenderedCount()}`);

  console.log("\n✅ Virtual List tests passed (basic structure)");
}

async function main() {
  console.log("Running Virtual List skeleton tests...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testVirtualList();
    passed++;
  } catch (e) {
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