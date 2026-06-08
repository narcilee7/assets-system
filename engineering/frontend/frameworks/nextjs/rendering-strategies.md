# Next.js 渲染策略

## 1. 五种渲染方式

| 方式 | 渲染时机 | 缓存 | 适用场景 |
|------|----------|------|----------|
| **CSR** | 客户端 | 无 | 强交互、后台管理 |
| **SSR** | 请求时服务端 | 可配置 | 实时数据、用户相关 |
| **SSG** | 构建时 | CDN 长期 | 博客、文档、营销页 |
| **ISR** | 构建时 + 增量更新 | CDN + 后台刷新 | 电商、新闻 |
| **RSC** | 请求时服务端 | 组件级 | 数据密集型页面 |

## 2. 决策树

```
页面需要实时数据？
  ├─ 是 → 用户个性化？
  │         ├─ 是 → SSR (getServerSideProps / dynamic rendering)
  │         └─ 否 → ISR (revalidate) / SSR
  │
  └─ 否 → 内容变化频率？
            ├─ 从不/很少 → SSG (getStaticProps)
            ├─ 中等 → ISR (revalidate: 3600)
            └─ 经常但非实时 → ISR (revalidate: 60)
```

## 3. App Router 中的渲染

```tsx
// app/page.tsx（默认 Server Component）
// SSR：每次请求服务端渲染
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store',  // 不缓存，每次请求都获取
  });

  return <Dashboard data={data} />;
}

// SSG：构建时获取，长期缓存
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'force-cache',  // 默认行为，长期缓存
  });

  return <BlogPost data={data} />;
}

// ISR：构建时获取，每小时重新验证
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 },  // 1 小时后后台重新生成
  });

  return <ProductList data={data} />;
}

// On-Demand Revalidation：按需重新验证
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';

export async function POST() {
  revalidatePath('/products');  // 手动触发 ISR 刷新
  return Response.json({ revalidated: true });
}
```

## 4. 混合渲染

```tsx
// app/page.tsx
import { Suspense } from 'react';
import { ProductList } from './ProductList';       // Server Component
import { Reviews } from './Reviews';               // Server Component（异步）
import { AddToCart } from './AddToCart';           // Client Component

export default function Page() {
  return (
    <div>
      {/* 同步 SSR */}
      <ProductList />

      {/* 异步流式渲染 */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />
      </Suspense>

      {/* 客户端交互 */}
      <AddToCart />
    </div>
  );
}
```
