# SSR 状态管理

## 1. 脱水与注水（Dehydrate / Rehydrate）

```
服务端流程：
1. 创建 Store
2. 获取数据（fetch data）
3. 数据存入 Store
4. 渲染 HTML
5. 将 Store 状态序列化 → 嵌入 HTML

客户端流程：
1. 接收 HTML（已渲染）
2. 解析内联的 Store 状态
3. 用该状态创建客户端 Store
4. Hydration 开始
5. 客户端 Store 与 HTML 同步
```

```javascript
// 服务端
import { createStore } from './store';

function renderApp(req) {
  const store = createStore();

  // 预取数据
  await store.dispatch(fetchUser(req.userId));
  await store.dispatch(fetchPosts());

  // 渲染
  const html = renderToString(
    <Provider store={store}>
      <App />
    </Provider>
  );

  // 序列化状态
  const initialState = JSON.stringify(store.getState());

  return `
    <div id="root">${html}</div>
    <script>
      window.__INITIAL_STATE__ = ${initialState};
    </script>
  `;
}

// 客户端
const preloadedState = window.__INITIAL_STATE__;
const store = createStore(preloadedState);

hydrateRoot(document.getElementById('root'),
  <Provider store={store}>
    <App />
  </Provider>
);
```

## 2. 请求隔离（避免状态泄漏）

```javascript
// ❌ 错误：全局 Store 导致请求间状态泄漏
const store = createStore();  // 全局单例

app.get('/', (req, res) => {
  store.dispatch(fetchData(req.query.id));  // 危险！
  const html = renderToString(<App store={store} />);
  res.send(html);
});

// ✅ 正确：每个请求创建独立 Store
app.get('/', async (req, res) => {
  const store = createStore();  // 每个请求新实例

  await store.dispatch(fetchData(req.query.id));
  const html = renderToString(<App store={store} />);

  res.send(`
    <div id="root">${html}</div>
    <script>window.__STATE__ = ${JSON.stringify(store.getState())}</script>
  `);
});

// React Context 实现请求隔离
const RequestContext = React.createContext(null);

function RequestProvider({ children, requestId }) {
  const store = useMemo(() => createStore(), [requestId]);
  return (
    <RequestContext.Provider value={{ store, requestId }}>
      {children}
    </RequestContext.Provider>
  );
}
```

## 3. TanStack Query（React Query）SSR

```javascript
// 服务端预取
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';

export default async function Page() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Posts />
    </HydrationBoundary>
  );
}

// 客户端组件
'use client';
import { useQuery } from '@tanstack/react-query';

function Posts() {
  // 服务端已预取，客户端直接使用缓存
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  return <PostList posts={data} />;
}
```

## 4. Pinia（Nuxt/Vue）SSR

```javascript
// stores/counter.js
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0);
  const double = computed(() => count.value * 2);
  function increment() {
    count.value++;
  }
  return { count, double, increment };
});

// Nuxt 自动处理脱水/注水
// 服务端渲染时自动序列化 Pinia 状态
// 客户端自动恢复

// 页面组件
<script setup>
const counter = useCounterStore();
// 服务端获取的数据自动同步到客户端
</script>
```

## 5. Zustand SSR

```javascript
// store.js
import { create } from 'zustand';

const useStore = create((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
}));

// 服务端
import { createStore } from './store';

function Page() {
  const store = createStore();
  // ... 预取数据

  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}

// 服务端输出
// <script>window.__ZUSTAND_STATE__ = {"bears": 5}</script>

// 客户端恢复
const store = createStore(JSON.parse(window.__ZUSTAND_STATE__));
```

## 6. 状态管理选型

| 库 | 框架 | SSR 支持 | 特点 |
|-----|------|---------|------|
| **TanStack Query** | React/Vue | ✅ 内置 | 服务端取数 + 缓存同步 |
| **Pinia** | Vue | ✅ 内置 | Nuxt 原生集成 |
| **Zustand** | React | ✅ 手动 | 轻量，需手动脱水 |
| **Jotai** | React | ✅ 内置 | 原子化，支持 Next.js |
| **Redux Toolkit** | React | ✅ 手动 | 需配置脱水逻辑 |
| **Valtio** | React/Vue | ✅ 手动 | 代理状态，需序列化 |
