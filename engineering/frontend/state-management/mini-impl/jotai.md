# 手写 Jotai

## 1. 核心思想

Jotai 的核心是 **Atom**：
- 每个 atom 是一个状态单元
- atom 可以有依赖关系（派生 atom）
- 组件订阅 atom，atom 变化时通知订阅者

```
atom(0) ──> atom((get) => get(count) * 2)
   │                │
   │                ▼
   │           derivedAtom
   │                │
   └──────────────> Component（订阅 count 和 derivedAtom）
```

## 2. 实现

```javascript
// mini-jotai.js

// 当前正在读取的 atom（用于依赖收集）
let currentAtom = null;

function atom(read, write) {
  const listeners = new Set();

  const atom = {
    value: undefined,
    read: typeof read === 'function' ? read : () => read,
    write: write || ((get, set, update) => set(update)),
    listeners,
    deps: new Set(),      // 依赖的 atom
    dependents: new Set(), // 依赖本 atom 的 atom
  };

  return atom;
}

// 读取 atom（带依赖收集）
function readAtom(atom) {
  const prevAtom = currentAtom;
  currentAtom = atom;
  atom.deps.clear();

  const get = (a) => {
    atom.deps.add(a);
    a.dependents.add(atom);
    return readAtomValue(a);
  };

  atom.value = atom.read(get);

  currentAtom = prevAtom;
  return atom.value;
}

function readAtomValue(atom) {
  // 如果 atom 有缓存且依赖没变，直接返回
  if (atom.value !== undefined && !atom.deps.size) {
    return atom.value;
  }
  return readAtom(atom);
}

// 写入 atom
function writeAtom(atom, update) {
  const get = (a) => readAtomValue(a);
  const set = (a, value) => {
    if (a.value !== value) {
      a.value = value;
      // 通知所有依赖者重新计算
      a.dependents.forEach((dependent) => {
        writeAtom(dependent, dependent.value);
      });
      // 通知监听者
      a.listeners.forEach((listener) => listener());
    }
  };

  atom.write(get, set, update);
}

// React Hook
function useAtom(atom) {
  const [value, setValue] = React.useState(() => readAtomValue(atom));

  React.useEffect(() => {
    const listener = () => setValue(readAtomValue(atom));
    atom.listeners.add(listener);
    return () => atom.listeners.delete(listener);
  }, [atom]);

  const setAtom = React.useCallback(
    (update) => writeAtom(atom, update),
    [atom]
  );

  return [value, setAtom];
}

function useAtomValue(atom) {
  const [value, setValue] = React.useState(() => readAtomValue(atom));

  React.useEffect(() => {
    const listener = () => setValue(readAtomValue(atom));
    atom.listeners.add(listener);
    return () => atom.listeners.delete(listener);
  }, [atom]);

  return value;
}

function useSetAtom(atom) {
  return React.useCallback((update) => writeAtom(atom, update), [atom]);
}

// ============ 使用 ============

const countAtom = atom(0);

const doubledAtom = atom((get) => get(countAtom) * 2);

const incrementAtom = atom(null, (get, set, by) => {
  set(countAtom, get(countAtom) + by);
});

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
```
