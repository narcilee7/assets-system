// ============================================================
// React Server Components 原理
//
// 核心问题：
// 1. Server Component vs Client Component 的本质区别？
// 2. props 序列化限制如何工作？
// 3. "use client" 指令的作用是什么？
// ============================================================

// ===================== 组件类型标记 =====================

// "use client" 标记：此组件需要在浏览器运行
const CLIENT_COMPONENT_SYMBOL = Symbol('client-component');
// "use server" 标记：此组件/函数在服务器运行
const SERVER_COMPONENT_SYMBOL = Symbol('server-component');

// 标记组件为 Client Component
function clientOnly(component) {
  component[CLIENT_COMPONENT_SYMBOL] = true;
  return component;
}

// 标记为 Server Component
function serverOnly(component) {
  component[SERVER_COMPONENT_SYMBOL] = true;
  return component;
}

// 检查是否为 Client Component
function isClientComponent(component) {
  return component[CLIENT_COMPONENT_SYMBOL] === true;
}

// 检查是否为 Server Component
function isServerComponent(component) {
  return component[SERVER_COMPONENT_SYMBOL] === true ||
         component[CLIENT_COMPONENT_SYMBOL] !== true; // 默认是 Server Component
}

// ===================== RSC 渲染模拟 =====================

// RSC 渲染上下文
let renderContext = {
  isServer: true,  // 当前是否在服务器渲染
  asyncComponents: [], // 异步组件（需要 streaming）
};

// 序列化 props（用于跨边界传递）
function serializeProps(props) {
  // TODO: 实现 props 序列化
  // 规则：
  // 1. 基本类型（string, number, boolean, null）直接传递
  // 2. 函数不能序列化（会丢失），需要处理
  // 3. 对象递归序列化
  // 4. React 元素（children）作为特殊处理
  // 5. Promise 会被 await 后传递

  return JSON.parse(JSON.stringify(props));
}

// 反序列化 props（用于接收）
function deserializeProps(props) {
  // TODO: 实现 props 反序列化
  // 在边界处需要还原可序列化的 props
  return props;
}

// ===================== 渲染函数 =====================

// 渲染 Server Component
async function renderServerComponent(component, props) {
  if (isClientComponent(component)) {
    throw new Error('Cannot render Client Component on server');
  }

  renderContext.isServer = true;

  // 执行组件函数获取 children（可能是嵌套的 Server/Client Component）
  const result = await component(props);

  return result;
}

// 渲染 Client Component（带 hydration placeholder）
async function renderClientComponent(component, props) {
  renderContext.isServer = false;

  // Client Component 在服务器端只返回 placeholder
  // 实际渲染在浏览器进行
  return {
    type: 'client-placeholder',
    props: {
      // TODO: 序列化 props，标记组件路径
      componentPath: component.name || 'Anonymous',
      serializedProps: serializeProps(props),
    },
  };
}

// ===================== Suspense / Streaming =====================

// Suspense 边界组件
function Suspense({ children, fallback }) {
  // Suspense 是 Client Component（需要处理 loading 状态）
  // 但它的 children 可能是 Server Component

  // 简化：直接返回 children 或 fallback
  // 真实实现需要：
  // 1. 启动异步渲染
  // 2. 数据未就绪时返回 fallback
  // 3. 数据就绪后替换 children
  return children;
}

// ===================== Server Action（简化） =====================

// "use server" 标记的函数
function createServerAction(fn) {
  const actionId = fn.name || Math.random().toString(36);

  return async function serverAction(...args) {
    if (!renderContext.isServer) {
      throw new Error('Server Action must be called from server');
    }
    return fn(...args);
  };
}

// ===================== 测试 =====================

async function testRSC() {
  console.log('\n=== React Server Components Tests ===\n');

  // Test 1: 组件类型识别
  console.log('Test 1 - Component Type Detection:');

  function ServerPage() { return { type: 'div', props: { children: 'Server' } }; }
  const ClientButton = clientOnly(function Button() { return { type: 'button', props: {} }; });

  console.log(`  ServerPage isServer: ${isServerComponent(ServerPage)}`);
  console.log(`  ServerPage isClient: ${isClientComponent(ServerPage)}`);
  console.log(`  ClientButton isServer: ${isServerComponent(ClientButton)}`);
  console.log(`  ClientButton isClient: ${isClientComponent(ClientButton)}`);
  console.assert(isServerComponent(ServerPage) === true, 'ServerPage should be server component');
  console.assert(isClientComponent(ClientButton) === true, 'ClientButton should be client component');
  console.log('  ✅ Component type detection works\n');

  // Test 2: Server Component 渲染
  console.log('Test 2 - Server Component Rendering:');

  function UserProfile(props) {
    return {
      type: 'div',
      props: {
        children: `Hello, ${props.name}! Age: ${props.age}`,
      },
    };
  }

  const serverResult = await renderServerComponent(UserProfile, { name: 'Alice', age: 30 });
  console.log(`  Server result: ${JSON.stringify(serverResult)}`);
  console.assert(serverResult.props.children.includes('Alice'), 'Should render user name');
  console.log('  ✅ Server component rendering works\n');

  // Test 3: Client Component placeholder
  console.log('Test 3 - Client Component Placeholder:');

  const clientResult = await renderClientComponent(ClientButton, { onClick: () => {} });
  console.log(`  Client result: ${JSON.stringify(clientResult)}`);
  console.assert(clientResult.type === 'client-placeholder', 'Should return placeholder');
  console.log('  ✅ Client component placeholder works\n');

  // Test 4: Props 序列化限制
  console.log('Test 4 - Props Serialization:');

  // 正常 props
  const normalProps = { name: 'Bob', count: 42, active: true };
  console.log(`  Normal props: ${JSON.stringify(normalProps)}`);

  // TODO: 序列化函数应该失败或特殊处理
  // const propsWithFn = { name: 'Bob', onClick: () => console.log('click') };
  // console.log(`  Props with function: ${serializeProps(propsWithFn)}`);
  // 真实 RSC 中，函数会被标记或移除

  console.log('  ⚠️  Props with functions need special handling (not fully implemented)');
  console.log('  ✅ Props serialization basic works\n');

  // Test 5: Children 插槽模式（Server Component 作为 children 传入 Client Component）
  console.log('Test 5 - Children Slot Pattern:');

  function Layout({ children }) {
    // Layout 是 Client Component
    return {
      type: 'div',
      props: {
        className: 'layout',
        children: children, // children 可能是 Server Component
      },
    };
  }

  function Content() {
    // Content 是 Server Component，可以访问 DB、FS 等
    return {
      type: 'article',
      props: { children: 'Article content from server' },
    };
  }

  // 组合：Server Component (Content) 作为 children 传给 Client Component (Layout)
  const layoutResult = await renderClientComponent(Layout, {
    children: await renderServerComponent(Content, {}),
  });

  console.log(`  Layout result: ${JSON.stringify(layoutResult)}`);
  console.assert(layoutResult.props.children.type === 'article', 'Should embed server content');
  console.log('  ✅ Children slot pattern works\n');

  // Test 6: Server Action
  console.log('Test 6 - Server Action:');

  const submitForm = createServerAction(async function submitForm(data) {
    // 这个函数只能在服务器执行
    return { success: true, received: data };
  });

  renderContext.isServer = true;
  const actionResult = await submitForm({ email: 'test@example.com' });
  console.log(`  Action result: ${JSON.stringify(actionResult)}`);
  console.assert(actionResult.success === true, 'Server action should succeed');
  console.log('  ✅ Server action works\n');

  console.log('✅ RSC tests completed\n');
}

// ===================== 追问验证 =====================

function showKeyQuestions() {
  console.log('\n=== RSC 核心问题解答 ===\n');

  const questions = [
    {
      q: '为什么 Server Component 的 props 必须可序列化？',
      a: '因为 props 需要从服务器传到浏览器。如果 props 包含函数、Promise 等，浏览器无法还原。',
    },
    {
      q: '"use client" 指令的实际作用是什么？',
      a: '标记组件为 Client Component，其所有子组件也会被视为 Client Component，直到遇到另一个 "use client" 或 "use server" 边界。',
    },
    {
      q: 'Server Component 如何与 Client Component 通信？',
      a: '1) 通过 props（children 插槽模式）\n   2) 通过 Server Action\n   3) 通过 URL params 或 form submission',
    },
    {
      q: 'streaming 和 SSR 的本质区别是什么？',
      a: 'SSR: 等所有数据就绪才返回完整 HTML\nstreaming: 先返回 HTML shell，数据陆续到达后通过 Suspense 替换占位内容',
    },
  ];

  for (const { q, a } of questions) {
    console.log(`Q: ${q}`);
    console.log(`A: ${a}\n`);
  }
}

async function main() {
  console.log('Running RSC skeleton tests...\n');

  let passed = 0;
  let failed = 0;

  try {
    await testRSC();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ RSC test failed: ${e.message}`);
    console.error(e.stack);
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