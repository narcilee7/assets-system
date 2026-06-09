# Svelte SSR 与 Hydration

## 1. SvelteKit 渲染策略

```
用户请求
    │
    ├── SSR (服务端渲染)
    │   ├── 执行组件逻辑
    │   ├── 生成 HTML
    │   └── 返回完整页面
    │
    ├── CSR (客户端渲染)
    │   └── 返回空壳 + JS Bundle
    │
    ├── SSG (静态生成)
    │   └── 构建时生成 HTML
    │
    └── ISR (增量静态再生)
        └── 首次 SSR + 缓存 + 后台重新生成
```

### 路由配置

```javascript
// +page.js
export const prerender = true;   // SSG
export const ssr = true;          // SSR
export const csr = true;          // 启用 hydration

// +page.server.js
export async function load({ params, fetch }) {
  // 服务端数据获取
  const post = await fetch(`/api/posts/${params.slug}`);
  return { post };
}
```

## 2. Hydration 过程

```html
<!-- 服务端返回的 HTML -->
<div id="svelte">
  <h1>Hello World</h1>
  <button>Click me</button>
</div>

<!-- 客户端加载 JS 后 -->
<script>
  // 1. Svelte 找到服务端渲染的 DOM
  // 2. 建立组件状态与 DOM 的关联
  // 3. 附加事件监听器
  // 4. 页面变为可交互
</script>
```

### Hydration 问题

```svelte
<script>
  let count = 0;
  // ❌ 问题：服务端渲染时 count 为 0
  // 但客户端 hydration 时，如果 JS 执行后 count 变成其他值
  // 会导致服务端和客户端渲染不一致
</script>

<!-- 解决方案：确保服务端和客户端初始状态一致 -->
<script>
  export let data;  // 从 +page.server.js 的 load 函数传入
  let count = data.initialCount;
</script>
```

## 3. Progressive Enhancement

```svelte
<!-- 渐进增强：没有 JS 也能工作 -->
<form method="POST" action="/search">
  <input name="q" value={query} />
  <button type="submit">Search</button>
</form>

<!-- 有 JS 时增强为无刷新搜索 -->
<script>
  import { enhance } from '$app/forms';
</script>

<form method="POST" action="/search" use:enhance>
  <input name="q" bind:value={query} />
  <button type="submit">Search</button>
</form>
```

`use:enhance` 是 SvelteKit 的渐进增强指令：
- 没有 JS：表单正常提交，页面刷新
- 有 JS：拦截表单提交，用 fetch 发送，无刷新更新页面
