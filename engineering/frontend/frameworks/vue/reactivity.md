# Vue 响应式系统

## 1. 从 Object.defineProperty 到 Proxy

Vue 2 使用 `Object.defineProperty`：

```javascript
// Vue 2 的响应式（简化）
function defineReactive(obj, key, val) {
  const dep = new Dep();  // 依赖收集器

  Object.defineProperty(obj, key, {
    get() {
      if (Dep.target) {
        dep.depend();  // 收集依赖
      }
      return val;
    },
    set(newVal) {
      if (val !== newVal) {
        val = newVal;
        dep.notify();  // 触发更新
      }
    },
  });
}
```

**限制**：
- 无法检测新增/删除属性（需要 `Vue.set` / `Vue.delete`）
- 无法检测数组索引访问和长度变化
- 递归遍历所有属性，初始化性能差

Vue 3 使用 `Proxy`：

```javascript
// Vue 3 的响应式（简化）
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      track(target, key);  // 收集依赖
      // 递归代理嵌套对象
      if (result && typeof result === 'object') {
        return reactive(result);
      }
      return result;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      if (oldValue !== value) {
        trigger(target, key);  // 触发更新
      }
      return result;
    },
    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);
      if (hadKey && result) {
        trigger(target, key);
      }
      return result;
    },
  });
}
```

**Proxy 的优势**：
- 可以拦截新增/删除属性
- 支持数组索引和 length
- 惰性递归（访问时才代理）

## 2. 依赖收集：Effect 与 Track/Trigger

```javascript
// 全局状态
let activeEffect = null;
const targetMap = new WeakMap();  // target -> (key -> Set<Effect>)

// 注册 effect
function effect(fn, options = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler);
  _effect.run();
  return _effect;
}

class ReactiveEffect {
  constructor(fn, scheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
    this.deps = [];  // 本 effect 依赖的所有 dep
  }

  run() {
    activeEffect = this;
    cleanupEffect(this);  // 清理旧依赖
    return this.fn();
  }

  stop() {
    cleanupEffect(this);
  }
}

// 收集依赖
track(target, key) {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }

  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = new Set()));
  }

  dep.add(activeEffect);
  activeEffect.deps.push(dep);
}

// 触发更新
trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach(effect => {
      if (effect.scheduler) {
        effect.scheduler();  // 异步调度
      } else {
        effect.run();        // 同步执行
      }
    });
  }
}

// 清理 effect 的旧依赖
function cleanupEffect(effect) {
  effect.deps.forEach(dep => dep.delete(effect));
  effect.deps.length = 0;
}
```

## 3. Ref：基本值的响应式

```javascript
function ref(value) {
  return new RefImpl(value);
}

class RefImpl {
  constructor(value) {
    this._value = value;
    this.__v_isRef = true;
  }

  get value() {
    track(this, 'value');
    return this._value;
  }

  set value(newVal) {
    if (newVal !== this._value) {
      this._value = newVal;
      trigger(this, 'value');
    }
  }
}

// 使用
const count = ref(0);
console.log(count.value);  // 0
count.value++;             // 触发更新
```

## 4. Computed：惰性计算

```javascript
function computed(getter) {
  let dirty = true;           // 是否需要重新计算
  let cachedValue;

  const _effect = new ReactiveEffect(getter, () => {
    if (!dirty) {
      dirty = true;
      trigger(computedRef, 'value');
    }
  });

  const computedRef = {
    get value() {
      if (dirty) {
        cachedValue = _effect.run();
        dirty = false;
        track(computedRef, 'value');
      }
      return cachedValue;
    },
  };

  return computedRef;
}

// 使用
const count = ref(0);
const doubled = computed(() => count.value * 2);

console.log(doubled.value);  // 计算并缓存
console.log(doubled.value);  // 直接返回缓存
count.value = 1;             // 标记 dirty
doubled.value;               // 重新计算
```

## 5. Watch：监听变化

```javascript
function watch(source, callback, options = {}) {
  let getter;
  if (typeof source === 'function') {
    getter = source;  // 函数直接作为 getter
  } else {
    getter = () => traverse(source);  // 递归遍历对象的每个属性
  }

  let oldValue;

  const job = () => {
    const newValue = _effect.run();
    callback(newValue, oldValue);
    oldValue = newValue;
  };

  const _effect = new ReactiveEffect(getter, () => {
    if (options.flush === 'post') {
      queuePostFlushCb(job);  // 组件更新后执行
    } else if (options.flush === 'sync') {
      job();                   // 同步执行
    } else {
      queueJob(job);           // 默认：组件更新前执行
    }
  });

  oldValue = _effect.run();
}

// 递归遍历对象的所有属性，确保每个属性都被追踪
function traverse(value, seen = new Set()) {
  if (!isObject(value) || seen.has(value)) return value;
  seen.add(value);
  for (const key in value) {
    traverse(value[key], seen);
  }
  return value;
}
```

## 6. 手写训练：最小响应式系统

```javascript
// 最小实现
let activeEffect;
const targetMap = new WeakMap();

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

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  depsMap.get(key)?.forEach(effect => effect());
}

function effect(fn) {
  activeEffect = fn;
  fn();
  activeEffect = null;
}

// 测试
const state = reactive({ count: 0 });
effect(() => {
  console.log('count =', state.count);
});
state.count++;  // 自动输出: count = 1
```
