# Jotai & Recoil：原子化状态

## 1. 核心思想

**原子（Atom）**：状态的最小单位。组件订阅原子，原子间可形成依赖图。

```
        atomA (count)
           │
     ┌─────┴─────┐
     ▼           ▼
  atomB       atomC
(doubled)   (isEven)
     │           │
     └─────┬─────┘
           ▼
       Component
```

**优势**：
- 细粒度订阅：组件只监听需要的原子，避免不必要的重渲染
- 组合性强：原子可派生其他原子
- 无 Context Provider 嵌套问题

## 2. Jotai

```tsx
import { atom, useAtom, useSetAtom, useAtomValue, Provider } from 'jotai';

// 基础原子
const countAtom = atom(0);

// 派生原子（只读）
const doubledAtom = atom((get) => get(countAtom) * 2);

// 派生原子（可写）
const incrementAtom = atom(null, (get, set, by: number) => {
  set(countAtom, (c) => c + by);
});

// 异步原子
const userAtom = atom(async (get) => {
  const response = await fetch('/api/user');
  return response.json();
});

// 组件中使用
function Counter() {
  const [count, setCount] = useAtom(countAtom);
  const doubled = useAtomValue(doubledAtom);
  const increment = useSetAtom(incrementAtom);

  return (
    <div>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
      <button onClick={() => increment(5)}>+5</button>
    </div>
  );
}

// 多个独立 Provider（作用域隔离）
function App() {
  return (
    <div>
      <Provider> {/* 独立的 countAtom 作用域 */}
        <Counter />
      </Provider>
      <Provider>
        <Counter />
      </Provider>
    </div>
  );
}
```

## 3. Atom Family

```tsx
import { atomFamily } from 'jotai/utils';

// 参数化原子：每个 todoId 对应一个独立的原子
const todoAtomFamily = atomFamily((id: string) =>
  atom({ id, text: '', completed: false })
);

function TodoItem({ id }: { id: string }) {
  const [todo, setTodo] = useAtom(todoAtomFamily(id));
  return (
    <div>
      <input
        value={todo.text}
        onChange={(e) => setTodo({ ...todo, text: e.target.value })}
      />
    </div>
  );
}

// 自动清理未使用的原子
// 或者用 atomWithStorage 持久化
const todoAtomFamily = atomFamily((id: string) =>
  atomWithStorage(`todo-${id}`, { id, text: '', completed: false })
);
```

## 4. Recoil（Meta 出品，Jotai 前身概念）

```tsx
import { atom, selector, useRecoilState, useRecoilValue, RecoilRoot } from 'recoil';

const countState = atom({ key: 'count', default: 0 });

const doubledState = selector({
  key: 'doubled',
  get: ({ get }) => get(countState) * 2,
});

// 异步 selector
const userState = selector({
  key: 'user',
  get: async ({ get }) => {
    const response = await fetch('/api/user');
    return response.json();
  },
});

// 使用
function Counter() {
  const [count, setCount] = useRecoilState(countState);
  const doubled = useRecoilValue(doubledState);
  return <div>{count} / {doubled}</div>;
}
```

**Jotai vs Recoil**：
- Jotai API 更简洁，不需要 `key`
- Jotai 支持作用域隔离（Provider）
- Jotai 生态更活跃，维护更好

## 5. 何时用原子化状态

| 场景 | 推荐 |
|------|------|
| 状态逻辑复杂、高度组合 | Jotai |
| 需要避免 Context 层级问题 | Jotai |
| 大量独立但相关的状态片 | Jotai atomFamily |
| 简单全局状态 | Zustand |
| 严格的数据流、团队协作 | Redux Toolkit |
