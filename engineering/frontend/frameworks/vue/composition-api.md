# Vue Composition API

## 1. 为什么需要 Composition API

Options API 的问题：

```javascript
// 同一个逻辑分散在 data、methods、computed、watch 中
export default {
  data() {
    return { mouseX: 0, mouseY: 0 };
  },
  mounted() {
    window.addEventListener('mousemove', this.onMouseMove);
  },
  destroyed() {
    window.removeEventListener('mousemove', this.onMouseMove);
  },
  methods: {
    onMouseMove(e) {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }
  }
};
```

Composition API：按功能组织代码，而非按选项类型。

```javascript
// 封装为可复用的 composable
function useMouse() {
  const x = ref(0);
  const y = ref(0);

  function update(e) {
    x.value = e.clientX;
    y.value = e.clientY;
  }

  onMounted(() => window.addEventListener('mousemove', update));
  onUnmounted(() => window.removeEventListener('mousemove', update));

  return { x, y };
}

// 组件中使用
export default {
  setup() {
    const { x, y } = useMouse();
    const { data, error } = useFetch('/api/user');

    return { x, y, data, error };
  }
};
```

## 2. Setup 函数的执行时机

```
组件生命周期
    │
    ├── beforeCreate     ← setup 在 beforeCreate 之后，created 之前执行
    ├── setup()           ← 此时 props 已解析，但 data/methods 尚未初始化
    ├── created
    ├── beforeMount
    ├── mounted
    ├── beforeUpdate
    ├── updated
    ├── beforeUnmount
    └── unmounted
```

```javascript
export default {
  props: ['id'],

  setup(props, context) {
    // props: 响应式对象（不能解构，会丢失响应性）
    console.log(props.id);

    // context: 暴露 slots、emit、attrs、expose
    context.emit('update', value);

    // 返回模板中使用的数据
    return {
      count: ref(0),
      increment: () => count.value++
    };
  }
};
```

## 3. 生命周期映射

| Options API | Composition API |
|-------------|-----------------|
| beforeCreate | 不需要（setup 替代） |
| created | 不需要（setup 替代） |
| beforeMount | onBeforeMount |
| mounted | onMounted |
| beforeUpdate | onBeforeUpdate |
| updated | onUpdated |
| beforeUnmount | onBeforeUnmount |
| unmounted | onUnmounted |
| errorCaptured | onErrorCaptured |
| renderTracked | onRenderTracked |
| renderTriggered | onRenderTriggered |

```javascript
import { onMounted, onUnmounted } from 'vue';

export default {
  setup() {
    onMounted(() => {
      console.log('mounted');
    });

    onUnmounted(() => {
      console.log('unmounted');
    });
  }
};
```

## 4. 与 Options API 对比

| 维度 | Options API | Composition API |
|------|-------------|-----------------|
| 代码组织 | 按选项类型（data/methods/computed） | 按功能逻辑（useXxx） |
| 逻辑复用 | Mixins（命名冲突、来源不透明） | Composables（显式导入） |
| TypeScript | 类型推导困难 | 类型推导友好 |
| 学习曲线 | 简单直观 | 需要理解响应式原理 |
| 适用场景 | 简单组件、选项式团队 | 复杂组件、逻辑复用、TS 项目 |

## 5. 常见 Composables 模式

```javascript
// useAsync: 异步数据获取
function useAsync(promiseFn) {
  const data = ref(null);
  const error = ref(null);
  const loading = ref(false);

  async function execute(...args) {
    loading.value = true;
    error.value = null;
    try {
      data.value = await promiseFn(...args);
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  }

  return { data, error, loading, execute };
}

// useLocalStorage: 持久化状态
function useLocalStorage(key, defaultValue) {
  const stored = localStorage.getItem(key);
  const value = ref(stored ? JSON.parse(stored) : defaultValue);

  watch(value, (newVal) => {
    localStorage.setItem(key, JSON.stringify(newVal));
  }, { deep: true });

  return value;
}

// useDebounce: 防抖
function useDebounce(value, delay) {
  const debounced = ref(value.value);

  let timeout;
  watch(value, (newVal) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      debounced.value = newVal;
    }, delay);
  });

  return debounced;
}
```
