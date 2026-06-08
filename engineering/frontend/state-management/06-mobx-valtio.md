# MobX & Valtio：可变状态

## 1. 核心思想

传统不可变状态：每次更新创建新对象，对比引用判断变化。

可变状态：**直接修改对象**，框架自动追踪变化。

```
不可变: state = { count: 0 }
        state = { ...state, count: state.count + 1 }

可变:   state.count++   // 直接修改，MobX/Valtio 自动通知订阅者
```

## 2. MobX

```ts
import { makeAutoObservable, autorun } from 'mobx';
import { observer } from 'mobx-react-lite';

class Store {
  count = 0;
  user = null;

  constructor() {
    makeAutoObservable(this);  // 自动追踪所有属性和方法
  }

  increment() {
    this.count++;  // 直接修改
  }

  get doubled() {
    return this.count * 2;  // 计算属性
  }

  async fetchUser() {
    const response = await fetch('/api/user');
    this.user = await response.json();  // 异步修改
  }
}

const store = new Store();

// 自动追踪依赖
autorun(() => {
  console.log('Count:', store.count);  // count 变化时自动执行
});

// React 组件
const Counter = observer(() => (
  <div>
    <p>{store.count}</p>
    <p>{store.doubled}</p>  {/* 自动追踪 doubled 依赖 */}
    <button onClick={() => store.increment()}>+1</button>
  </div>
));
```

### MobX 的响应式追踪

```ts
import { makeObservable, observable, computed, action } from 'mobx';

class TodoStore {
  todos = [];

  constructor() {
    makeObservable(this, {
      todos: observable,      // 追踪数组变化
      completedCount: computed,  // 缓存计算结果
      addTodo: action,        // 标记为 action（批量更新）
    });
  }

  get completedCount() {
    return this.todos.filter((t) => t.completed).length;
  }

  addTodo(text) {
    this.todos.push({ text, completed: false });
  }
}
```

## 3. Valtio（更轻量的 MobX）

```ts
import { proxy, useSnapshot } from 'valtio';

// 创建响应式对象
const state = proxy({
  count: 0,
  nested: { deep: { value: 10 } },
});

// 直接修改
state.count++;
state.nested.deep.value = 20;

// React 组件
function Counter() {
  const snap = useSnapshot(state);  // 只读快照，自动追踪
  return <div>{snap.count}</div>;   // 只追踪 count，nested 变化不触发重渲染
}

// 订阅（非 React）
import { subscribe } from 'valtio';
subscribe(state, () => {
  console.log('State changed:', state.count);
});

// 派生状态
import { derive } from 'valtio/utils';
const derived = derive({
  doubled: (get) => get(state).count * 2,
});
```

## 4. MobX vs Valtio

| 维度 | MobX | Valtio |
|------|------|--------|
| 风格 | OOP（class） | FP（plain object） |
| React 集成 | `observer` HOC | `useSnapshot` hook |
| TypeScript | 需装饰器或 `makeObservable` | 原生友好 |
| 大小 | ~20KB | ~3KB |
| 生态 | 丰富（mobx-state-tree） | 较小 |
| 适用 | 大型 OOP 项目 | 快速开发、小项目 |
