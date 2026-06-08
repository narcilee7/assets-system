# Zustand

## 1. 核心思想

Zustand（德语"状态"）是一个极简的全局状态库：
- **无样板代码**：不需要 action types、reducers、providers
- **TypeScript 友好**：类型推导自然
- **高性能**：精确订阅，组件只监听需要的状态
- **跨框架**：React / Vue / Vanilla JS 都能用

## 2. 基础用法

```ts
import { create } from 'zustand';

// 创建 store
const useBearStore = create((set, get) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  decrease: () => set((state) => ({ bears: state.bears - 1 })),
  removeAll: () => set({ bears: 0 }),

  // 使用 get 访问当前状态
  increaseBy: (by) => set((state) => ({ bears: state.bears + by })),

  // 异步 action
  fetchBears: async () => {
    const response = await fetch('/api/bears');
    const data = await response.json();
    set({ bears: data.count });
  },
}));

// 组件中使用
function BearCounter() {
  const bears = useBearStore((state) => state.bears);  // 精确订阅
  return <h1>{bears} bears</h1>;
}

function Controls() {
  const increase = useBearStore((state) => state.increase);
  return <button onClick={increase}>+1</button>;
}
```

## 3. 多 Slice 组合

```ts
// slices/userSlice.ts
const createUserSlice = (set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  isAuthenticated: () => get().user !== null,
});

// slices/cartSlice.ts
const createCartSlice = (set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  total: () => get().items.reduce((sum, i) => sum + i.price, 0),
});

// store.ts
const useStore = create((set, get) => ({
  ...createUserSlice(set, get),
  ...createCartSlice(set, get),
}));
```

## 4. 中间件

```ts
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set) => ({
          // state
          nested: { count: 0 },
          // 用 immer 直接修改
          increment: () =>
            set((draft) => { draft.nested.count += 1; }),
        }))
      ),
      { name: 'my-app-storage' }
    ),
    { name: 'MyStore' }
  )
);
```

| 中间件 | 作用 |
|--------|------|
| `devtools` | Redux DevTools 集成 |
| `persist` | localStorage/sessionStorage 持久化 |
| `immer` | 可变语法写不可变更新 |
| `subscribeWithSelector` | 细粒度订阅，支持 selector + equality fn |

## 5. 订阅与外部使用

```ts
// 在组件外使用（非 React 场景）
const bears = useBearStore.getState().bears;
useBearStore.setState({ bears: 10 });

// 订阅变化
const unsubscribe = useBearStore.subscribe(
  (state) => state.bears,           // selector
  (bears, prevBears) => {           // 回调
    console.log(`Bears changed: ${prevBears} -> ${bears}`);
  }
);

// 在另一个 store 中监听
useUserStore.subscribe(
  (state) => state.user,
  (user) => {
    if (user) useCartStore.getState().fetchCart();
  }
);
```

## 6. Zustand vs Redux

| 维度 | Zustand | Redux Toolkit |
|------|---------|---------------|
| 样板代码 | 极少 | 中等（slice 模式） |
| DevTools | 可选中间件 | 内置 |
| 时间旅行 | 支持（devtools） | 内置 |
| 中间件生态 | 较小 | 丰富 |
| 大型项目 | 够用 | 更规范 |
| 学习成本 | 低 | 中 |
