# Mini-Framework：响应式状态系统

## 1. 目标

实现一个类似 Vue 3 的响应式系统：
- `reactive()`：对象响应式
- `ref()`：值类型响应式
- `computed()`：派生值
- `watch()` / `watchEffect()`：副作用

## 2. 核心原理：依赖收集 + 触发更新

```
reactive({ count: 0 })
    │
    ▼ Proxy 拦截
get count ──► 当前活跃的 effect ──► 存入依赖桶（Set）
    │                              │
    ▼                              ▼
set count ──► 从依赖桶取出 effect ──► 全部执行
```

## 3. 简化实现

```javascript
// ============ 核心：依赖收集 ============

// 当前活跃的 effect
let activeEffect = null;

// 依赖桶：target -> key -> Set<effect>
const bucket = new WeakMap();

// 注册 effect
function effect(fn) {
  const effectFn = () => {
    // 执行前清理旧依赖
    cleanup(effectFn);
    activeEffect = effectFn;
    fn();
    activeEffect = null;
  };
  // 存储 effect 关联的所有依赖集合
  effectFn.deps = [];
  effectFn();
}

// 清理：从所有依赖集合中移除当前 effect
function cleanup(effectFn) {
  for (const deps of effectFn.deps) {
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}

// ============ 核心：Proxy ============

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      track(target, key);
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      trigger(target, key);
      return true;
    },
  });
}

// 依赖收集
function track(target, key) {
  if (!activeEffect) return;

  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }

  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }

  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

// 触发更新
function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;

  const deps = depsMap.get(key);
  if (deps) {
    // 复制 Set 避免在遍历过程中修改
    [...deps].forEach((fn) => fn());
  }
}

// ============ 使用 ============

const state = reactive({ count: 0 });

effect(() => {
  console.log('count =', state.count);  // 首次执行输出: count = 0
});

state.count++;  // 触发 effect，输出: count = 1
state.count++;  // 触发 effect，输出: count = 2
```

## 4. ref 实现

```javascript
function ref(value) {
  const wrapper = {
    get value() {
      track(wrapper, 'value');
      return value;
    },
    set value(newVal) {
      value = newVal;
      trigger(wrapper, 'value');
    },
  };
  return wrapper;
}

// 使用
const count = ref(0);

effect(() => {
  console.log('count =', count.value);
});

count.value++;  // 触发更新
```

## 5. computed 实现

```javascript
function computed(getter) {
  const result = ref();

  effect(() => {
    result.value = getter();
  });

  return {
    get value() {
      return result.value;
    },
  };
}

// 使用
const state = reactive({ firstName: 'John', lastName: 'Doe' });
const fullName = computed(() => `${state.firstName} ${state.lastName}`);

console.log(fullName.value);  // John Doe
state.firstName = 'Jane';      // 触发 computed 重新计算
console.log(fullName.value);  // Jane Doe
```
