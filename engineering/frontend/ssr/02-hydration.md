# Hydration 原理与优化

## 1. Hydration 是什么

```
服务端渲染 → 客户端接管

服务端输出：
  <div id="app">
    <button>Click me</button>
    <span>Count: 0</span>
  </div>

客户端执行：
  1. 下载 React/Vue 运行时 JS
  2. 重新构建虚拟 DOM
  3. 与真实 DOM 对比（diff）
  4. 绑定事件监听器
  5. 应用变得可交互

问题：服务端已经渲染了 HTML，客户端又做了一遍！
```

## 2. Hydration 问题

### 问题 1：重复工作
- 服务端渲染了整个 DOM 树
- 客户端又创建了一遍 VDOM 树
- 大型页面 Hydration 可能耗时 500ms+

### 问题 2：Hydration Mismatch
```jsx
// 服务端：new Date() 在服务端执行
const serverTime = new Date().toISOString();

// 客户端：new Date() 在客户端执行（时间不同）
// → Hydration mismatch！
function Component() {
  return <time>{new Date().toISOString()}</time>;  // ❌
}

// 修复：只在客户端执行，或固定服务端值
function Component({ serverTime }) {
  const [time, setTime] = useState(serverTime);
  useEffect(() => {
    setTime(new Date().toISOString());  // 只在客户端更新
  }, []);
  return <time>{time}</time>;
}
```

### 问题 3：JS 体积
- Hydration 需要完整的框架运行时
- 静态内容页也下载了大量不必要的 JS

## 3. 优化策略

### 策略 1：选择性 Hydration（Partial Hydration）

```jsx
// React 18: Selective Hydration
// 使用 Suspense 边界隔离 Hydration 范围

function Page() {
  return (
    <>
      <Header />  {/* 优先 Hydration */}
      <Suspense fallback={<Skeleton />}>
        <HeavyWidget />  {/* 延迟 Hydration */}
      </Suspense>
      <Footer />  {/* 低优先级 */}
    </>
  );
}

// React 18 自动按交互优先级 Hydration：
// 1. 用户点击的区域优先
// 2. 可见区域次之
// 3. 屏幕外区域最后
```

### 策略 2：Islands Architecture

```astro
---
// Astro  Islands 架构
// 默认：零 JS 发送到客户端
---

<!-- 静态内容：零 JS -->
<header>
  <h1>我的博客</h1>
  <nav>...</nav>
</header>

<article>
  <!-- 文章内容：纯 HTML -->
  <p>...</p>
</article>

<!-- 交互组件：只发送需要的 JS -->
<LikeButton client:load />        <!-- 立即 Hydration -->
<Comments client:visible />       <!-- 进入视口后 Hydration -->
<ShareWidget client:media="(min-width: 768px)" />  <!-- 媒体查询匹配后 -->
<Analytics client:idle />         <!-- 浏览器空闲时加载 -->
```

```
传统 SSR：整个页面 Hydration
  ┌─────────────────────────────┐
  │ Header │ Content │ Footer    │ 全部注水
  └─────────────────────────────┘

Islands：仅交互组件 Hydration
  ┌─────────────────────────────┐
  │ Header │ Content │ Footer    │ 纯静态（无 JS）
  │        │ [🏝️Like]│           │ 仅岛屿注水
  │        │ [🏝️Cmnt]│           │
  └─────────────────────────────┘
```

### 策略 3：Resumable（Qwik）

```tsx
// Qwik: 无需 Hydration，直接恢复状态
// 服务端序列化应用状态到 HTML

export const Counter = component$(() => {
  const count = useSignal(0);  // 状态自动序列化

  return (
    <button onClick$={() => count.value++}>
      Count: {count.value}
    </button>
  );
});

// 输出 HTML：
// <button on:click="app_Counter_onClick_abc123">
//   Count: 0
// </button>
// <script type="qwik/json">{"count": 0}</script>

// 点击时：
// 1. 按需下载对应的 handler chunk
// 2. 恢复状态
// 3. 执行
// 无需重建整个 VDOM！
```

### 策略 4：Progressive Hydration

```javascript
// 延迟非关键组件的 Hydration
function ProgressiveHydration({ children, delay = 2000 }) {
  const [shouldHydrate, setShouldHydrate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldHydrate(true), delay);
    return () => clearTimeout(timer);
  }, []);

  if (!shouldHydrate) {
    return <div dangerouslySetInnerHTML={{ __html: '' }} suppressHydrationWarning />;
  }

  return children;
}

// 使用
<ProgressiveHydration delay={3000}>
  <Footer />  {/* 3秒后才 Hydration */}
</ProgressiveHydration>
```
