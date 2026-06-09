# Next.js React Server Components

## 1. Next.js 中的 Client/Server 边界

```tsx
// app/page.tsx（默认 Server Component）
import { UserList } from './UserList';      // Server Component
import { LikeButton } from './LikeButton';  // Client Component

export default async function Page() {
  // 直接在服务端获取数据
  const users = await fetch('https://api.example.com/users');

  return (
    <div>
      <UserList users={users} />     {/* 服务端渲染 */}
      <LikeButton />                  {/* 客户端交互 */}
    </div>
  );
}
```

```tsx
// components/LikeButton.tsx
'use client';  // 标记为 Client Component

import { useState } from 'react';

export function LikeButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>{liked ? '♥' : '♡'}</button>;
}
```

## 2. Server Component 的异步数据获取

```tsx
// 推荐：直接在 Server Component 中 await
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);

  return (
    <div>
      <h1>{user.name}</h1>
      <Posts userId={userId} />  {/* 嵌套 Server Component */}
    </div>
  );
}

// 并行数据获取
async function Dashboard() {
  const [user, orders, notifications] = await Promise.all([
    fetchUser(),
    fetchOrders(),
    fetchNotifications(),
  ]);

  return (
    <div>
      <UserCard user={user} />
      <OrderList orders={orders} />
      <NotificationBell notifications={notifications} />
    </div>
  );
}
```

## 3. Streaming

```tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      {/* 立即渲染，不等待 */}
      <Header />

      {/* 先显示骨架屏，数据到达后流式填充 */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails />
      </Suspense>

      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />
      </Suspense>
    </div>
  );
}
```

**Streaming 的优势**：
- 不需要等待所有数据就绪才返回 HTML
- 用户更快看到首屏内容
- 每个 Suspense 边界独立加载

## 4. 第三方库处理

```tsx
// 问题：某些库使用了浏览器 API
import { Carousel } from 'some-carousel-lib';  // 内部使用 window/document

// 解决方案 1：在 Client Component 中使用
'use client';
export function ProductCarousel() {
  return <Carousel />;
}

// 解决方案 2：动态导入（SSR 禁用）
import dynamic from 'next/dynamic';

const Carousel = dynamic(() => import('some-carousel-lib'), {
  ssr: false,
});
```
