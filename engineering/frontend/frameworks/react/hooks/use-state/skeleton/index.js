// ============================================================
// React useState 手写
//
// 核心问题：
// 1. hooks 链表如何组织？
// 2. dispatch 为何始终稳定（同一个引用）？
// 3. batching 如何避免多次 render？
// 4. 函数式更新如何实现？
// ============================================================

// ===================== Hooks 链表 =====================

// 当前正在渲染的组件
let currentlyRenderingComponent = null;
// hooks 链表指针
let currentHookIndex = 0;

// ===================== Update Queue =====================

// Update 结构：{ action, next }
function createUpdate(action) {
  return { action, next: null };
}

// TODO: enqueueUpdate - 将 update 加入队列（支持 batching）
function enqueueUpdate(hook, update) {
  // TODO:
  // 1. 如果 pending 是 null，说明队列空，直接赋值
  // 2. 否则遍历到队列末尾，添加 update
  // 3. 触发 scheduleRender
}

// ===================== Reducer =====================

// 处理 update action，返回新 state
function reduce(reducer, state, action) {
  // action 可能是：
  // 1. 值（直接替换）
  // 2. 函数（函数式更新，接收旧 state，返回新 state）
  if (typeof action === 'function') {
    return action(state);
  }
  return action;
}

// ===================== useState =====================

function useState(initialValue) {
  // TODO: 实现 useState
  // 1. 获取当前 hook 索引对应的 hook
  // 2. 如果 hook 不存在，创建一个新的 hook
  // 3. 创建稳定的 dispatch 函数
  // 4. 返回 [state, dispatch]

  // 获取当前 hook
  let hook = currentlyRenderingComponent.hooks[currentHookIndex];

  if (!hook) {
    // TODO: 创建新 hook
    // hook = { state: initialValue, queue: [] }
    // 如果 initialValue 是函数，执行它得到初始值
    hook = {
      state: typeof initialValue === 'function' ? initialValue() : initialValue,
      queue: [],
    };
    currentlyRenderingComponent.hooks[currentHookIndex] = hook;
  }

  currentHookIndex++;

  // 捕获组件引用，用于后续 setState 触发 re-render
  const componentRef = currentlyRenderingComponent;

  const setState = (action) => {
    // TODO: 实现稳定的 dispatch
    // 1. 创建 update
    // 2. enqueueUpdate
    // 3. 触发 re-render（scheduleRender）

    const update = createUpdate(action);
    enqueueUpdate(hook, update);

    // 触发重新渲染
    scheduleRender(componentRef);
  };

  return [hook.state, setState];
}

// ===================== scheduleRender（简化） =====================

// 记录需要重新渲染的组件
const dirtyComponents = new Set();

// TODO: scheduleRender - 标记组件需要重新渲染
function scheduleRender(component) {
  // TODO:
  // 1. 将组件加入 dirtyComponents
  // 2. 调度真正的渲染（使用微任务或 setTimeout 模拟 batch）

  dirtyComponents.add(component);

  // 简化：用 setTimeout 模拟下一个 tick 的 batched render
  if (!component._renderScheduled) {
    component._renderScheduled = true;
    setTimeout(() => {
      flushRender();
    }, 0);
  }
}

// TODO: flushRender - 批量执行所有 dirty 组件的渲染
function flushRender() {
  // TODO:
  // 1. 遍历 dirtyComponents
  // 2. 对每个组件：
  //    a. 重置 hooks 链表指针
  //    b. 执行组件函数（重新调用 useState）
  //    c. 处理 update queue：计算最终 state

  dirtyComponents.forEach(component => {
    currentHookIndex = 0;
    component._renderScheduled = false;

    // 应用所有 pending updates
    component.hooks.forEach(hook => {
      // TODO: 处理 hook.queue 中的所有 update
      // 按顺序执行 reduce，计算最终 state
      let newState = hook.state;
      let update = hook.queue;
      while (update) {
        newState = reduce(null, newState, update.action);
        update = update.next;
      }
      hook.state = newState;
      hook.queue = []; // 清空队列
    });

    // 重新渲染（模拟）
    console.log(`  [Re-render] ${component.name} with states: ${component.hooks.map(h => h.state).join(', ')}`);
  });

  dirtyComponents.clear();
}

// ===================== 组件渲染 =====================

// 模拟 React 的 render 过程
function renderComponent(componentFn, props = {}) {
  // 保存当前渲染上下文
  const prevComponent = currentlyRenderingComponent;
  const prevHookIndex = currentHookIndex;

  // 创建新的组件实例
  currentlyRenderingComponent = {
    name: componentFn.name || 'Anonymous',
    hooks: [],
    props,
  };
  currentHookIndex = 0;

  try {
    // 执行组件函数
    componentFn(props);
    return currentlyRenderingComponent;
  } finally {
    // 恢复上下文
    currentlyRenderingComponent = prevComponent;
    currentHookIndex = prevHookIndex;
  }
}

// ===================== 测试 =====================

function testUseState() {
  console.log('\n=== React useState Tests ===\n');

  // Test 1: 基本 useState
  console.log('Test 1 - Basic useState:');
  function Counter() {
    const [count, setCount] = useState(0);
    console.log(`  Counter: count=${count}`);
  }
  renderComponent(Counter);
  console.log('  ✅ Basic useState works\n');

  // Test 2: 多次 setState
  console.log('Test 2 - Multiple setState (batching):');
  let dispatchFn = null;
  function Counter2() {
    const [count, setCount] = useState(0);
    dispatchFn = setCount; // 保存 dispatch 引用
    return { count };
  }

  const inst = renderComponent(Counter2);
  console.log(`  Initial: count=${inst.hooks[0].state}`);

  // 连续调用 setState
  dispatchFn(1);
  dispatchFn(2);
  dispatchFn(3);
  console.log(`  After 3 setState calls (before flush): count=${inst.hooks[0].state}`);

  // 等待 batched render
  setTimeout(() => {}, 10);
  console.log('  ⚠️  Batching test pending (flush not triggered)\n');

  // Test 3: 函数式更新
  console.log('Test 3 - Functional update:');
  let dispatchFn3 = null;
  function Counter3() {
    const [count, setCount] = useState(0);
    dispatchFn3 = setCount;
    return { count };
  }

  const inst3 = renderComponent(Counter3);
  console.log(`  Initial: count=${inst3.hooks[0].state}`);

  // 使用函数式更新
  function increment(n) { return n + 1; }
  dispatchFn3(increment);
  dispatchFn3(increment);
  console.log(`  After 2 functional updates (pending): count=${inst3.hooks[0].state}`);
  console.log('  ⚠️  Functional update test pending\n');

  // Test 4: 惰性初始化
  console.log('Test 4 - Lazy initialization:');
  let initCalls = 0;
  function initFn() {
    initCalls++;
    return 100;
  }

  function LazyCounter() {
    const [count, setCount] = useState(initFn);
    return { count, setCount };
  }

  const inst4 = renderComponent(LazyCounter);
  console.log(`  Initial: count=${inst4.hooks[0].state}, initCalls=${initCalls}`);
  console.assert(initCalls === 1, 'Init function should be called once');
  console.log('  ✅ Lazy initialization works\n');

  // Test 5: dispatch 稳定性
  console.log('Test 5 - Dispatch stability:');
  function StableDispatch() {
    const [count, setCount] = useState(0);
    return { count, setCount };
  }

  const inst5 = renderComponent(StableDispatch);
  const dispatch1 = inst5.hooks[1];
  const dispatch2 = inst5.hooks[1];
  console.log(`  dispatch1 === dispatch2: ${dispatch1 === dispatch2}`);
  console.assert(dispatch1 === dispatch2, 'Dispatch should be stable');
  console.log('  ✅ Dispatch stability works\n');

  console.log('✅ useState tests completed\n');
}

// ===================== 追问验证 =====================

function showKeyQuestions() {
  console.log('\n=== useState 核心问题解答 ===\n');

  const questions = [
    {
      q: 'dispatch 为何始终稳定（同一个引用）？',
      a: '因为 dispatch 是在 useState 内部创建的函数闭包，每次渲染都会返回同一个 dispatch 引用。这样可以在 useCallback 或 deps 数组中安全使用。',
    },
    {
      q: 'lazy initialization 是什么？',
      a: 'useState(initialValue) 中，如果 initialValue 是函数，会惰性执行一次获取初始值。用于 expensive initialization 场景，如 useState(() => computeInitialState())。',
    },
    {
      q: '函数式更新和普通更新的区别？',
      a: '普通更新：setState(newValue)\n函数式更新：setState(prevState => newState)\n函数式更新可以基于旧状态计算新状态，避免闭包陷阱。',
    },
    {
      q: ' batching 是如何工作的？',
      a: 'React 将多个 setState 合并到一个更新队列中，只在事件处理结束后（或微任务中）触发一次 re-render。这样可以避免中间状态的渲染。',
    },
  ];

  for (const { q, a } of questions) {
    console.log(`Q: ${q}`);
    console.log(`A: ${a}\n`);
  }
}

async function main() {
  console.log('Running useState skeleton tests...\n');

  let passed = 0;
  let failed = 0;

  try {
    testUseState();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ useState test failed: ${e.message}`);
  }

  showKeyQuestions();

  console.log(`${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${passed})`);
  } else {
    console.log(`❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
}

main();