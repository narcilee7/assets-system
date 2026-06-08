# 手写 Zustand

## 1. 核心思想

Zustand 就是一个闭包 + 发布订阅 + selector：

```
create((set, get) => state)
  │
  ├── 闭包持有 state
  ├── set 修改 state 并通知订阅者
  ├── get 读取当前 state
  └── listeners 管理订阅
```

## 2. 实现

```javascript
// mini-zustand.js

function create(createState) {
  let state;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const nextState = typeof partial === 'function'
      ? partial(state)
      : partial;

    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = replace ?? typeof nextState !== 'object'
        ? nextState
        : Object.assign({}, state, nextState);

      listeners.forEach((listener) => listener(state, previousState));
    }
  };

  const getState = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const destroy = () => listeners.clear();

  const api = { setState, getState, subscribe, destroy };

  // 初始化 state
  state = createState(setState, getState, api);

  // 返回 useStore hook（React 绑定）
  return (selector = getState, equalityFn = Object.is) => {
    const [, forceUpdate] = React.useReducer((c) => c + 1, 0);
    const stateRef = React.useRef();
    const selectorRef = React.useRef(selector);
    const equalityFnRef = React.useRef(equalityFn);

    const selectedState = selector(state);
    stateRef.current = selectedState;

    React.useEffect(() => {
      const listener = (newState) => {
        const newSelected = selectorRef.current(newState);
        if (!equalityFnRef.current(stateRef.current, newSelected)) {
          stateRef.current = newSelected;
          forceUpdate();
        }
      };

      const unsubscribe = subscribe(listener);
      return unsubscribe;
    }, []);

    return selectedState;
  };
}

// ============ 使用 ============

const useStore = create((set, get) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  decrease: () => set((state) => ({ bears: state.bears - 1 })),
}));

// 组件中使用
function BearCounter() {
  const bears = useStore((state) => state.bears);
  return <h1>{bears} bears</h1>;
}

function Controls() {
  const increase = useStore((state) => state.increase);
  return <button onClick={increase}>+1</button>;
}
```

## 3. Middleware 实现

```javascript
// persist middleware
function persist(config, options) {
  return (set, get, api) => {
    const { name, storage = localStorage, partialize = (state) => state } = options;

    // 从 storage 恢复
    try {
      const stored = storage.getItem(name);
      if (stored) {
        set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to hydrate', e);
    }

    // 包装 setState 以持久化
    const originalSet = api.setState;
    api.setState = (...args) => {
      originalSet(...args);
      try {
        storage.setItem(name, JSON.stringify(partialize(get())));
      } catch (e) {
        console.error('Failed to persist', e);
      }
    };

    return config(set, get, api);
  };
}

// 使用
const useStore = create(
  persist(
    (set) => ({ theme: 'light', setTheme: (theme) => set({ theme }) }),
    { name: 'theme-storage' }
  )
);
```
