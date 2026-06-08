# Mini-Framework：Hooks 实现

## 1. 目标

实现简化版 React Hooks：
- `useState`
- `useEffect`
- `useMemo`
- `useRef`

## 2. useState 实现

```javascript
// 当前正在渲染的组件 Fiber
let wipFiber = null;
// Hook 索引
let hookIndex = null;

function useState(initial) {
  // 获取旧 Hook（用于复用状态）
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  // 初始化或复用 Hook
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],  // 待执行的更新
  };

  // 执行队列中的所有更新
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach((action) => {
    hook.state = action(hook.state);
  });

  // 创建 setState 函数
  const setState = (action) => {
    hook.queue.push(action);
    // 触发重新渲染
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
  };

  wipFiber.hooks.push(hook);
  hookIndex++;

  return [hook.state, setState];
}
```

## 3. useEffect 实现

```javascript
function useEffect(effect, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hasChanged = deps
    ? !oldHook || !deps.every((dep, i) => dep === oldHook.deps[i])
    : true;

  const hook = {
    effect: hasChanged ? effect : null,  // 依赖变化才执行
    deps,
    cleanup: oldHook ? oldHook.cleanup : null,
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
}

// 在 commit 阶段执行 effect
function commitEffects() {
  runEffects(wipRoot);
}

function runEffects(fiber) {
  if (!fiber) return;

  if (fiber.hooks) {
    fiber.hooks
      .filter((hook) => hook.effect)
      .forEach((hook) => {
        // 先执行 cleanup
        if (hook.cleanup) hook.cleanup();
        // 再执行 effect
        hook.cleanup = hook.effect();
      });
  }

  runEffects(fiber.child);
  runEffects(fiber.sibling);
}
```

## 4. useMemo 实现

```javascript
function useMemo(factory, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hasChanged = deps
    ? !oldHook || !deps.every((dep, i) => dep === oldHook.deps[i])
    : true;

  const hook = {
    value: hasChanged ? factory() : oldHook.value,
    deps,
  };

  wipFiber.hooks.push(hook);
  hookIndex++;

  return hook.value;
}
```

## 5. useRef 实现

```javascript
function useRef(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    current: oldHook ? oldHook.current : initial,
  };

  wipFiber.hooks.push(hook);
  hookIndex++;

  return hook;
}
```

## 6. 完整使用示例

```javascript
function MyComponent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('React');

  const double = useMemo(() => count * 2, [count]);

  const inputRef = useRef(null);

  useEffect(() => {
    console.log('count changed:', count);
    document.title = `Count: ${count}`;

    return () => {
      console.log('cleanup');
    };
  }, [count]);

  return {
    type: 'div',
    props: {
      children: [
        { type: 'h1', props: {}, children: [`${name}: ${double}`] },
        {
          type: 'button',
          props: {
            onClick: () => setCount((c) => c + 1),
          },
          children: ['Increment'],
        },
      ],
    },
  };
}
```
