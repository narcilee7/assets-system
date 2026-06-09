# Pinia 状态管理

## 1. 设计理念

Pinia = Vuex 5 的进化版：
- 去除 mutations（直接修改 state）
- 完整的 TypeScript 支持
- 更轻量（~1KB）
- Devtools 支持更好
- 模块即 store，无需嵌套命名空间

## 2. Store 定义

```javascript
// stores/counter.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Option API 风格
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0, name: 'Eduardo' }),
  getters: {
    doubleCount: (state) => state.count * 2,
  },
  actions: {
    increment() {
      this.count++;
    },
  },
});

// Composition API 风格（推荐）
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0);
  const name = ref('Eduardo');

  const doubleCount = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }

  return { count, name, doubleCount, increment };
});
```

## 3. 在组件中使用

```javascript
import { useCounterStore } from '@/stores/counter';

export default {
  setup() {
    const counter = useCounterStore();

    // 直接修改 state
    counter.count++;

    // 调用 action
    counter.increment();

    // 解构时使用 storeToRefs 保持响应性
    const { count, doubleCount } = storeToRefs(counter);
    const { increment } = counter;

    return { count, doubleCount, increment };
  }
};
```

## 4. 与 Vuex 对比

| 特性 | Vuex 4 | Pinia |
|------|--------|-------|
| mutations | ✅ 必须 | ❌ 不需要 |
| 直接修改 state | ❌ 必须通过 mutation | ✅ 可以直接修改 |
| TypeScript | 困难（需要类型封装） | 原生支持 |
| 模块嵌套 | 支持嵌套命名空间 | 扁平化，每个 store 独立 |
| 体积 | ~2KB | ~1KB |
| Devtools | 支持 | 支持更好（time travel） |
| SSR | 需要特殊处理 hydration | 原生支持 |

## 5. Store 组合

```javascript
// stores/user.js
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false);
  const user = ref(null);

  async function login(credentials) {
    user.value = await api.login(credentials);
    isLoggedIn.value = true;
  }

  return { isLoggedIn, user, login };
});

// stores/cart.js（依赖 user store）
import { useUserStore } from './user';

export const useCartStore = defineStore('cart', () => {
  const items = ref([]);
  const userStore = useUserStore();  // 组合其他 store

  const totalPrice = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  async function checkout() {
    if (!userStore.isLoggedIn) {
      throw new Error('Please login first');
    }
    await api.createOrder({
      userId: userStore.user.id,
      items: items.value,
    });
    items.value = [];
  }

  return { items, totalPrice, checkout };
});
```

## 6. 插件系统

```javascript
// plugins/persist.js
import { createPinia } from 'pinia';

function persistPlugin({ store }) {
  // 从 localStorage 恢复
  const stored = localStorage.getItem(store.$id);
  if (stored) {
    store.$patch(JSON.parse(stored));
  }

  // 订阅变化，持久化到 localStorage
  store.$subscribe((mutation, state) => {
    localStorage.setItem(store.$id, JSON.stringify(state));
  });
}

const pinia = createPinia();
pinia.use(persistPlugin);
```
