# 状态设计原则

## 1. 五大原则

| 原则 | 含义 | 反例 |
|------|------|------|
| **单一职责** | 一个状态只负责一件事 | `userState` 同时存用户信息和 UI 状态 |
| **最小化存储** | 只存必要数据，派生数据不算 | `fullName` 和 `firstName`/`lastName` 都存 |
| **派生优先** | 能算出来的不要存 | `cartTotal` 存到 state 里 |
| **规范化** | 避免嵌套，用 ID 引用 | `{ posts: [{ comments: [{...}] }] }` |
| **不可变性** | 状态更新创建新对象 | `state.count++` 直接修改 |

## 2. 最小化存储：派生优先

```tsx
// ❌ 反例：派生数据也存
const useStore = create(() => ({
  items: [],
  total: 0,        // 派生数据
  itemCount: 0,    // 派生数据

  addItem: (item) => {
    set((state) => ({
      items: [...state.items, item],
      total: state.total + item.price,      // 手动维护
      itemCount: state.itemCount + 1,       // 手动维护
    }));
  },
}));

// ✅ 正例：只存原始数据，派生用 selector/computed
const useCartStore = create(() => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}));

// 派生值
const useCartTotal = () => useCartStore((s) =>
  s.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
);
const useCartCount = () => useCartStore((s) => s.items.length);

// Vue Pinia 写法
const useCartStore = defineStore('cart', () => {
  const items = ref([]);
  const total = computed(() => items.value.reduce((sum, i) => sum + i.price * i.quantity, 0));
  return { items, total };
});
```

## 3. 规范化：避免嵌套

```tsx
// ❌ 反例：深度嵌套，更新困难
const state = {
  posts: [
    {
      id: 1,
      title: 'Hello',
      comments: [
        { id: 101, text: 'Nice', author: { id: 5, name: 'John' } },
      ],
    },
  ],
};

// 更新一个 comment 的 text：
// state.posts[0].comments[0].text = 'Updated';  // 不可变更新极其繁琐

// ✅ 正例：规范化存储（类似数据库）
const state = {
  posts: {
    ids: [1, 2, 3],
    entities: {
      1: { id: 1, title: 'Hello', commentIds: [101, 102] },
      2: { id: 2, title: 'World', commentIds: [] },
    },
  },
  comments: {
    ids: [101, 102],
    entities: {
      101: { id: 101, text: 'Nice', postId: 1, authorId: 5 },
      102: { id: 102, text: 'Thanks', postId: 1, authorId: 6 },
    },
  },
  users: {
    ids: [5, 6],
    entities: {
      5: { id: 5, name: 'John' },
      6: { id: 6, name: 'Jane' },
    },
  },
};

// 更新 comment 只需要：
// state.comments.entities[101].text = 'Updated';

// RTK 的 createEntityAdapter 自动处理规范化
import { createEntityAdapter } from '@reduxjs/toolkit';

const postsAdapter = createEntityAdapter({
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});
```

## 4. 不可变性

```tsx
// ❌ 直接修改
state.user.name = 'New Name';
state.items.push(newItem);

// ✅ 创建新对象（Redux / Zustand 要求）
set((state) => ({
  user: { ...state.user, name: 'New Name' },
  items: [...state.items, newItem],
}));

// ✅ 用 Immer 简化（Zustand 内置，Redux Toolkit 内置）
import { produce } from 'immer';

set(produce((draft) => {
  draft.user.name = 'New Name';      // 直接修改，Immer 自动处理不可变性
  draft.items.push(newItem);
}));

// Zustand 直接支持
const useStore = create((set) => ({
  items: [],
  addItem: (item) => set(produce((draft) => { draft.items.push(item); })),
}));
```

## 5. 状态拆分策略

```tsx
// ❌ 反例：单一大 store
const useStore = create(() => ({
  // 用户
  user: null, isAuth: false,
  // UI
  theme: 'light', sidebarOpen: true,
  // 数据
  posts: [], comments: [],
  // 购物车
  cart: [],
  // 几十个 action...
}));

// ✅ 正例：按域拆分
const useUserStore = create(() => ({ user: null, login: () => {} }));
const useUIStore = create(() => ({ theme: 'light', toggleTheme: () => {} }));
const useCartStore = create(() => ({ items: [], addItem: () => {} }));
const usePostStore = create(() => ({ posts: [], fetchPosts: () => {} }));

// 跨 store 组合（Zustand）
const useBoundStore = create((...a) => ({
  ...createUserSlice(...a),
  ...createCartSlice(...a),
}));
```
