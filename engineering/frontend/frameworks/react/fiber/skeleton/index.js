// ============================================================
// 简化版 Fiber 架构
//
// 目标：理解 React 16+ 的 render 机制
// - Fiber node 结构
// - workLoop 和 performUnitOfWork
// - render phase / commit phase 分离
// - 双缓冲（current / workInProgress）
// ============================================================

// ===================== DOM 模拟 =====================

class DOM {
  static createElement(tag, props, ...children) {
    return { tag, props: props || {}, children };
  }

  static render(vnode, container) {
    // TODO: 将 vnode 转换为真实 DOM 并挂载到 container
    // vnode: { tag, props, children }
    // 1. 创建 DOM 节点 document.createElement(vnode.tag)
    // 2. 设置 props（排除 children 和 event handlers）
    // 3. 处理 children：递归创建并 append
    // 4. append 到 container
  }

  static updateDom属性(existingDom, newProps, oldProps = {}) {
    // TODO: 比较 newProps 和 oldProps，更新差异部分
    // 1. 处理新增/修改的属性
    // 2. 处理删除的属性（oldProps 有但 newProps 没有）
    // 3. 跳过 children 和事件处理函数
  }
}

// ===================== Fiber 数据结构 =====================

// Fiber 节点类型
const ElementType = {
  HOST: 'host',        // div, span, p 等原生标签
  FUNCTION: 'function', // 函数组件
  CLASS: 'class',       // 类组件（简化版不实现）
  TEXT: 'text',         // 文本节点
};

// Effect tag - 标记节点操作类型
const EffectTag = {
  UPDATE: 'UPDATE',     // 更新
  NEW: 'NEW',           // 新增
  DELETE: 'DELETE',     // 删除
};

// Fiber 节点结构
// 每个 React 元素对应一个 Fiber node
function createFiber(vnode, returnFiber, childIndex) {
  return {
    // 基本属性
    type: vnode.tag,
    props: vnode.props,
    key: vnode.key,
    // 节点类型：host / function / text
    elementType: vnode.tag, // 简化：直接用 tag
    // 树结构
    return: returnFiber,    // 父节点
    child: null,            // 第一个子节点
    sibling: null,          // 下一个兄弟节点
    // DOM 引用
    stateNode: null,        // 对应的真实 DOM 节点
    // Effect 相关
    effectTag: null,        // NEW / UPDATE / DELETE
    // 双缓冲
    alternate: null,        // 指向 current tree 中对应的节点
    //  hooks（仅函数组件）
    memorizedState: null,   // useState 的 state
    pendingProps: null,     // 待处理的 props
    // 子节点数组（用于构建 fiber tree）
    children: vnode.children || [],
  };
}

// ===================== 全局变量 =====================

let nextUnitOfWork = null;  // 下一个要处理的 fiber
let workInProgressRoot = null; // workInProgress tree 的根节点
let currentRoot = null;     // current tree 的根节点（commit 后更新）
let deletedTree = null;     // 待删除的节点列表

// ===================== render 入口 =====================

function render(vnode, container) {
  // TODO: render 入口
  // 1. 创建 workInProgressRoot = { fiberRoot }
  // 2. 设置 nextUnitOfWork = workInProgressRoot.child（第一个 fiber）
  // 3. 启动 workLoop

  // 简化：直接构建 fiber tree 并 commit
  const rootFiber = createFiber(vnode, null, 0);
  rootFiber.effectTag = EffectTag.NEW;
  rootFiber.stateNode = container;

  workInProgressRoot = {
    current: rootFiber,
    container: container,
  };

  // 构建子 fiber
  reconcileChildren(null, rootFiber);

  // 设置首个 work
  nextUnitOfWork = rootFiber.child;

  // 启动 workLoop
  workLoop();
}

function workLoop() {
  // TODO: workLoop
  // 循环处理 nextUnitOfWork，直到没有更多 work
  // 1. while (nextUnitOfWork) { nextUnitOfWork = performUnitOfWork(nextUnitOfWork) }
  // 2. 处理完后，调用 commitRoot 提交所有变更
}

// ===================== performUnitOfWork =====================

function performUnitOfWork(fiber) {
  // TODO: 处理一个 fiber 节点
  // 返回值：下一个要处理的 fiber（用于遍历）

  // 1. 如果是函数组件，调用组件函数获取 children
  // 2. 创建子 fiber（reconcileChildren）
  // 3. 返回下一个要处理的 fiber：
  //    - 如果有 child，返回 child
  //    - 否则如果有 sibling，返回 sibling
  //    - 否则返回 return 的 sibling（向上回溯）

  // 简化：只处理 host 组件
  if (fiber.elementType === 'host') {
    if (!fiber.stateNode) {
      // 创建 DOM 节点
      fiber.stateNode = document.createElement(fiber.type);
      updateDom属性(fiber.stateNode, fiber.props, {});
    }

    // 协调子节点
    reconcileChildren(fiber, fiber);

    // 返回下一个 fiber
    if (fiber.child) return fiber.child;
    let current = fiber;
    while (current) {
      if (current.sibling) return current.sibling;
      current = current.return;
    }
    return null;
  }

  return null;
}

// ===================== reconcileChildren =====================

function reconcileChildren(returnFiber, workInProgressFiber) {
  // TODO: 为 fiber 的 children 创建 fiber
  // 并设置 child / sibling 链表关系

  const children = workInProgressFiber.children || [];
  let prevSibling = null;
  let oldFiber = workInProgressFiber.alternate?.child;

  children.forEach((child, index) => {
    const newFiber = createFiber(child, returnFiber, index);

    // 比较 oldFiber 和 newFiber，决定是 UPDATE 还是 NEW
    // 简化：全部标记为 NEW
    newFiber.effectTag = EffectTag.NEW;
    newFiber.alternate = oldFiber;

    // 设置链表关系
    if (index === 0) {
      workInProgressFiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    if (oldFiber) oldFiber = oldFiber.sibling;
  });

  // 清理被删除的节点
  while (oldFiber) {
    // TODO: 标记为 DELETE，加入待删除列表
    oldFiber = oldFiber.sibling;
  }
}

// ===================== commitRoot =====================

function commitRoot() {
  // TODO: commit phase
  // 遍历 fiber tree，执行所有 NEW effect

  let fiber = workInProgressRoot.current.child;
  while (fiber) {
    commitWork(fiber);
    fiber = getNextFiber(fiber);
  }

  // 交换 current 和 workInProgress
  currentRoot = workInProgressRoot.current;
  workInProgressRoot = null;
}

function commitWork(fiber) {
  // TODO: 提交单个 fiber 的 DOM 操作
  // 1. 如果有 DOM 节点需要创建/添加，执行 DOM 操作
  // 2. 递归处理 child 和 sibling
}

function getNextFiber(fiber) {
  // 深度优先遍历：child -> sibling -> return.sibling
  if (fiber.child) return fiber.child;
  if (fiber.sibling) return fiber.sibling;
  let current = fiber.return;
  while (current) {
    if (current.sibling) return current.sibling;
    current = current.return;
  }
  return null;
}

// ===================== 工具函数 =====================

function updateDom属性(dom, newProps, oldProps = {}) {
  // TODO: 更新 DOM 属性
  // 1. 遍历 newProps，添加/更新属性
  // 2. 遍历 oldProps，删除不在 newProps 中的属性
  // 3. 跳过 children、key、ref
}

// ===================== 测试 =====================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testFiber() {
  console.log('\n=== Fiber Tests ===');

  const container = { children: [], appendChild: (c) => { container.children.push(c); } };

  // 创建模拟 document
  global.document = {
    createElement: (tag) => ({
      tag,
      children: [],
      props: {},
      appendChild: function(c) { this.children.push(c); },
      setAttribute: function(k, v) { this.props[k] = v; },
    }),
  };

  // Test 1: 渲染单个 div
  console.log('\nTest 1 - Render single div:');
  const vnode1 = DOM.createElement('div', { id: 'app' }, 'Hello');
  render(vnode1, container);
  console.log(`  Container children: ${container.children.length}`);
  console.log(`  First child tag: ${container.children[0]?.tag}`);
  console.assert(container.children.length > 0, 'Should have children');
  console.log('  ✅ Basic render works');

  // Test 2: 渲染嵌套结构
  console.log('\nTest 2 - Render nested:');
  const vnode2 = DOM.createElement('div', { class: 'container' },
    DOM.createElement('h1', null, 'Title'),
    DOM.createElement('p', null, 'Paragraph')
  );
  const container2 = { children: [] };
  render(vnode2, container2);
  console.log(`  Container children: ${container2.children.length}`);
  console.log('  ✅ Nested render works');

  // Test 3: 更新（reconciliation）
  console.log('\nTest 3 - Update (reconciliation):');
  const vnode3 = DOM.createElement('div', { class: 'container updated' },
    DOM.createElement('h1', null, 'New Title'),
    DOM.createElement('p', null, 'New Paragraph')
  );
  // TODO: 实现 update
  console.log('  ⚠️  Update not implemented yet');

  console.log('\n✅ Fiber tests completed');
}

async function main() {
  console.log('Running Fiber skeleton tests...\n');

  let passed = 0;
  let failed = 0;

  try {
    await testFiber();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Fiber test failed: ${e.message}`);
    console.error(e.stack);
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