# 状态管理性能优化

## 1. 避免不必要的重渲染

```tsx
// ❌ 反例：订阅整个 store
const state = useStore();  // 任何字段变化都触发重渲染

// ✅ 正例：精确订阅
const count = useStore((s) => s.count);  // 只订阅 count

// ✅ 多个字段用 selector
const { name, email } = useStore(
  useShallow((s) => ({ name: s.user.name, email: s.user.email }))
);

// Zustand 的 shallow 比较
import { shallow } from 'zustand/shallow';
const [count, name] = useStore((s) => [s.count, s.name], shallow);
```

## 2. Selector 优化

```tsx
// ❌ 每次创建新对象（总是触发重渲染）
const user = useSelector((state) => ({ name: state.user.name, age: state.user.age }));

// ✅ 用 reselect 创建记忆化 selector
import { createSelector } from '@reduxjs/toolkit';

const selectUser = (state) => state.user;
const selectUserName = createSelector([selectUser], (user) => user.name);
const selectUserDisplay = createSelector(
  [selectUser],
  (user) => ({ name: user.name, age: user.age })
);

// ✅ 用 useMemo（简单场景）
const userSummary = useSelector((state) => state.user);
const displayInfo = useMemo(
  () => ({ name: userSummary.name, initials: userSummary.name[0] }),
  [userSummary.name]
);
```

## 3. 状态拆分

```tsx
// ❌ 单一大 store（任何字段变化影响所有订阅者）
const useBigStore = create(() => ({
  user: {}, cart: [], ui: {}, settings: {},
}));

// ✅ 按域拆分
const useUserStore = create(() => ({ user: {} }));
const useCartStore = create(() => ({ cart: [] }));
const useUIStore = create(() => ({ theme: 'light' }));

// ✅ 按读写拆分（Zustand）
const useBoundStore = create((set, get) => ({
  // 状态
  count: 0,
  // 派生（不存储）
  get doubled() { return get().count * 2; },
  // Actions
  increment: () => set((s) => ({ count: s.count + 1 })),
}));
```

## 4. 批量更新

```tsx
// ❌ 多次 set 触发多次重渲染
set((s) => ({ a: 1 }));
set((s) => ({ b: 2 }));
set((s) => ({ c: 3 }));

// ✅ 一次 set 更新多个字段
set((s) => ({ a: 1, b: 2, c: 3 }));

// ✅ Redux / Zustand 自动 batch（React 18+）
// 在事件处理函数中，多次 dispatch 会自动 batch
function handleClick() {
  dispatch(increment());
  dispatch(setName('New'));
  // 只触发一次重渲染
}
```

## 5. 大型列表优化

```tsx
// ❌ 把整个列表存到一个原子
const itemsAtom = atom([...10000 items]);

// ✅ 用 atomFamily 拆分
const itemAtomFamily = atomFamily((id) => atom({ id, text: '' }));
const itemIdsAtom = atom([1, 2, 3, ...]);  // 只存 ID 列表

// 组件只订阅单个 item
function ItemRow({ id }) {
  const [item, setItem] = useAtom(itemAtomFamily(id));  // 只重渲染这一个
  return <div>{item.text}</div>;
}

// ✅ 用规范化存储
const state = {
  items: {
    ids: [1, 2, 3],
    entities: { 1: {...}, 2: {...}, 3: {...} },
  },
};
```

## 6. 性能检查清单

- [ ] 组件是否订阅了不必要的状态？
- [ ] Selector 是否返回了稳定的引用？
- [ ] 大数组是否用规范化存储？
- [ ] 是否避免在 render 中创建新函数/对象？
- [ ] 是否使用了 React.memo / useMemo / useCallback？
- [ ] 状态库是否支持精确订阅（Zustand selector / Jotai atom）？
