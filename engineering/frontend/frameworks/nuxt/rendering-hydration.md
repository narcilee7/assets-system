# Nuxt 渲染与 Hydration

## 1. 渲染模式

### CSR（客户端渲染）

```vue
<!-- pages/index.vue -->
<script setup>
const { data } = await useFetch('/api/data');  // 客户端获取
</script>
```

### SSR（服务端渲染）

```vue
<script setup>
// 服务端获取数据，返回完整 HTML
const { data } = await useFetch('/api/data');

// useFetch 是 SSR 安全的：服务端获取 → 注入 HTML → 客户端复用
</script>
```

### SSG（静态生成）

```bash
# nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      routes: ['/about', '/blog/**'],
    },
  },
});

# 构建
nuxt generate
```

### ISR（增量静态再生）

```vue
<script setup>
const { data } = await useFetch('/api/posts', {
  key: 'posts',
  server: true,
  default: () => [],
  transform: (posts) => posts.slice(0, 10),
});
</script>
```

配合 Nitro 缓存：

```ts
// server/api/posts.ts
export default defineEventHandler(async (event) => {
  // 设置 ISR 缓存头
  event.node.res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

  return await fetchPosts();
});
```

## 2. useFetch 与 useAsyncData

```vue
<script setup>
// useFetch：基于 useAsyncData 的语法糖，自动处理 URL
const { data, pending, error, refresh } = await useFetch('/api/users', {
  key: 'users',           // 缓存 key
  server: true,           // 服务端获取
  lazy: false,            // 是否懒加载
  immediate: true,        // 立即执行
  transform: (data) => {  // 数据转换
    return data.map(u => ({ ...u, fullName: `${u.first} ${u.last}` }));
  },
  pick: ['id', 'name'],   // 只选取部分字段（减少 payload）
});

// useAsyncData：更灵活，可执行任意异步逻辑
const { data: posts } = await useAsyncData('posts', async () => {
  const [posts, categories] = await Promise.all([
    $fetch('/api/posts'),
    $fetch('/api/categories'),
  ]);
  return { posts, categories };
});
</script>
```

## 3. Hydration 注意事项

```vue
<script setup>
const count = ref(0);

// ❌ 问题：服务端和客户端生成的 id 不一致
const id = Math.random().toString(36);

// ✅ 解决方案：使用 useId()
const id = useId();

// ❌ 问题：服务端没有 window/document
onMounted(() => {
  // ✅ 在客户端执行
  window.addEventListener('scroll', handleScroll);
});
</script>
```

```vue
<!-- 客户端专用组件 -->
<template>
  <ClientOnly>
    <ChartComponent :data="data" />
    <template #fallback>
      <ChartSkeleton />
    </template>
  </ClientOnly>
</template>
```
