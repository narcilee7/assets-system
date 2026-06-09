# Next.js 缓存体系

## 1. 四层缓存架构

```
Data Cache (fetch)          Router Cache (客户端)       Full Route Cache (服务端)
     │                            │                            │
     │ fetch('/api/data', {       │ <Link prefetch>            │ 构建时/请求时
     │   next: {                  │ 预加载路由                   │ 缓存渲染结果
     │     revalidate: 3600       │                            │
     │   }                        │                            │
     │ })                         │                            │
     ▼                            ▼                            ▼
┌─────────────┐             ┌─────────────┐              ┌─────────────┐
│ 服务端数据    │             │ 客户端路由   │              │ 完整页面     │
│ 缓存         │             │ 缓存        │              │ 缓存        │
│             │             │             │              │             │
│ - 按 URL    │             │ - 按路由    │              │ - 按路由    │
│   缓存      │             │ - 内存中    │              │ - 服务端    │
│ - 可持久化   │             │ - 软导航   │              │ - RSC Payload
│   到磁盘    │             │   时复用   │              │   缓存      │
└─────────────┘             └─────────────┘              └─────────────┘
```

## 2. Data Cache（fetch 缓存）

```tsx
// 1. 长期缓存（默认）
const data = await fetch('https://api.example.com/data');
// 等效于: cache: 'force-cache'

// 2. 不缓存
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store',
});

// 3. ISR 缓存
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 },  // 60 秒后重新验证
});

// 4. 标签缓存（用于按需失效）
const data = await fetch('https://api.example.com/data', {
  next: { tags: ['products'] },
});

// 失效：app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
revalidateTag('products');
```

## 3. Router Cache（客户端）

- 用户点击 `<Link>` 时，Next.js 自动预加载路由数据
- 软导航（客户端路由跳转）时复用缓存
- 刷新页面（F5）会清除客户端缓存

```tsx
// 控制预加载
<Link href="/dashboard" prefetch={false}>  {/* 禁用预加载 */}
  Dashboard
</Link>

<Link href="/dashboard" prefetch={true}>   {/* 默认：悬停时预加载 */}
  Dashboard
</Link>
```

## 4. 缓存失效策略

| 操作 | Data Cache | Full Route Cache | Router Cache |
|------|-----------|------------------|--------------|
| 重新部署 | 保留 | 清除 | 清除 |
| `revalidatePath()` | 不受影响 | 重新验证 | 清除 |
| `revalidateTag()` | 匹配 tag 的清除 | 相关路由重新验证 | 清除 |
| `router.refresh()` | 清除 | 清除 | 清除 |
| 时间过期（ISR） | 标记为 stale | 后台重新生成 | 不受影响 |
