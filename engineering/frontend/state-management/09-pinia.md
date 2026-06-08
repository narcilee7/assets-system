# Pinia

## 1. 核心特性

Vue 官方推荐的状态管理库（Vuex 的继任者）：
- **TypeScript 友好**：完整的类型推导，无需复杂的类型封装
- **组合式 API**：`setup` 风格的 store 定义
- **无 mutation**：直接修改 state（有 devtools 追踪）
- **模块化**：自动模块，无需命名空间
- **SSR 友好**：内置 hydration 支持

## 2. 定义 Store

```ts
// stores/counter.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Option API 风格（类似 Vuex）
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0, name: 'Eduardo' }),
  getters: {
    doubleCount: (state) => state.count * 2,
    doublePlusOne(): number { return this.doubleCount + 1; },
  },
  actions: {
    increment() { this.count++; },
    async fetchUser() {
      const response = await fetch('/api/user');
      this.name = (await response.json()).name;
    },
  },
});

// Setup 风格（推荐，Composition API）
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0);
  const name = ref('Eduardo');

  const doubleCount = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }

  async function fetchUser() {
    const response = await fetch('/api/user');
    name.value = (await response.json()).name;
  }

  return { count, name, doubleCount, increment, fetchUser };
});
```

## 3. 组件中使用

```vue
<script setup>
import { useCounterStore } from '@/stores/counter';
import { storeToRefs } from 'pinia';

const store = useCounterStore();

// storeToRefs：只提取响应式引用，不提取方法
const { count, doubleCount } = storeToRefs(store);
const { increment } = store;

// 直接修改 state（无需 mutation）
store.count++;
store.$patch({ count: store.count + 1 });  // 批量修改
store.$patch((state) => { state.count++; });  // 函数式修改

// 重置
store.$reset();
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Double: {{ doubleCount }}</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

## 4. Store 组合

```ts
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const user = ref(null);
  const isAdmin = computed(() => user.value?.role === 'admin');
  return { user, isAdmin };
});

// stores/cart.ts（依赖 user store）
export const useCartStore = defineStore('cart', () => {
  const items = ref([]);
  const userStore = useUserStore();  // 在 store 中引用其他 store

  const canCheckout = computed(() =>
    items.value.length > 0 && userStore.user !== null
  );

  function addItem(product) {
    if (!userStore.isAdmin && product.restricted) return;
    items.value.push(product);
  }

  return { items, canCheckout, addItem };
});
```

## 5. 插件

```ts
// pinia-plugin-persistedstate
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

pinia.use(piniaPluginPersistedstate);

// store 中配置
export const useStore = defineStore('main', {
  state: () => ({ user: null, theme: 'light' }),
  persist: {
    key: 'my-app',
    paths: ['theme'],  // 只持久化 theme
    storage: localStorage,
  },
});
```

## 6. Pinia vs Vuex

| 特性 | Pinia | Vuex 4 |
|------|-------|--------|
| mutation | ❌ 不需要 | ✅ 必需 |
| TypeScript | 原生友好 | 需要复杂封装 |
| 模块 | 自动 | 手动配置 namespace |
| 大小 | ~1KB | ~1.5KB |
| 组合式 API | 原生支持 | 通过辅助函数 |
| 官方推荐 | ✅ Vue 3 | ⚠️ legacy |
