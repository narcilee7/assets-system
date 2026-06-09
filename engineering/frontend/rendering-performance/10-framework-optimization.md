# 框架特定优化

## 1. React 优化

```tsx
// ✅ React.memo：纯组件避免不必要的重渲染
const ListItem = React.memo(({ item }) => {
  return <div>{item.name}</div>;
});

// ✅ useMemo：缓存计算结果
const sortedItems = useMemo(() => {
  return [...items].sort((a, b) => a.priority - b.priority);
}, [items]);

// ✅ useCallback：缓存回调函数
const handleClick = useCallback((id) => {
  setSelected(id);
}, []);

// ✅ 虚拟化长列表
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={10000}
  itemSize={50}
>
  {Row}
</FixedSizeList>

// ✅ Suspense + lazy 代码分割
const Dashboard = lazy(() => import('./Dashboard'));

// ✅ 使用 startTransition（非紧急更新）
startTransition(() => {
  setSearchQuery(input);  // 搜索输入可以延迟
});
```

## 2. Vue 优化

```vue
<script setup>
// ✅ v-once：只渲染一次
<div v-once>{{ heavyContent }}</div>

// ✅ v-memo：条件缓存
<div v-memo="[selectedId]">
  <!-- 只有 selectedId 变化时才重新渲染 -->
</div>

// ✅ computed：缓存计算属性
const filteredList = computed(() => {
  return list.value.filter(item => item.active);
});

// ✅ keep-alive：缓存组件状态
<keep-alive>
  <component :is="currentTab" />
</keep-alive>

// ✅ defineAsyncComponent：异步组件
const AsyncModal = defineAsyncComponent(() => import('./Modal.vue'));
</script>
```

## 3. Svelte 优化

```svelte
<!-- Svelte 编译时自动优化 -->
<!-- 但仍需注意： -->

<!-- ✅ 使用 {#key} 强制重新创建 -->
{#key url}
  <Component {url} />
{/key}

<!-- ✅ 使用 $derived 缓存派生值 -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);  // 自动缓存
</script>
```
