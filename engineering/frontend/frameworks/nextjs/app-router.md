# Next.js App Router

## 1. 文件系统路由

```
app/
├── page.tsx              # / (首页)
├── layout.tsx            # 根布局
├── loading.tsx           # 全局 loading
├── error.tsx             # 全局 error
├── not-found.tsx         # 404
│
├── blog/
│   ├── page.tsx          # /blog
│   ├── layout.tsx        # /blog 布局
│   └── [slug]/
│       ├── page.tsx      # /blog/:slug (动态路由)
│       └── opengraph-image.tsx  # OG 图片生成
│
├── dashboard/
│   ├── page.tsx
│   ├── @sidebar/         # Parallel Route (并行路由)
│   │   └── page.tsx
│   ├── @main/
│   │   └── page.tsx
│   └── layout.tsx        # 接收 parallel routes: { sidebar, main }
│
├── (marketing)/          # Route Group (无 URL 前缀)
│   ├── about/
│   │   └── page.tsx      # /about
│   └── contact/
│       └── page.tsx      # /contact
│
└── [...catchall]/
    └── page.tsx          # 兜底路由
```

## 2. Layout vs Template

```tsx
// app/layout.tsx（持久化，状态保持）
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Nav />      {/* 导航切换时不重新渲染 */}
        {children}   {/* 页面内容 */}
      </body>
    </html>
  );
}

// app/template.tsx（每次导航重新挂载）
export default function Template({ children }) {
  return (
    <AnimationWrapper>  {/* 每次页面切换都执行入场动画 */}
      {children}
    </AnimationWrapper>
  );
}
```

| 特性 | Layout | Template |
|------|--------|----------|
| 导航时 | 状态保持 | 重新挂载 |
| 使用场景 | 共享 UI（Nav/Sidebar） | 动画、状态重置 |

## 3. Parallel Routes

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  sidebar,    // 对应 @sidebar/page.tsx
  main,        // 对应 @main/page.tsx
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  main: React.ReactNode;
}) {
  return (
    <div className="dashboard">
      <aside>{sidebar}</aside>
      <main>{main}</main>
      {children}
    </div>
  );
}
```

**用途**：条件渲染、模态框、标签页。

## 4. Intercepting Routes

```
app/
├── feed/
│   └── page.tsx           # /feed (正常列表页)
└── feed/
    └── (.)photo/[id]/     # 拦截 /photo/:id
        └── page.tsx       # 在 feed 页面内显示模态框
```

访问 `/photo/1` 时：
- 直接访问 → 全屏照片页
- 从 `/feed` 点击 → 在 feed 页面内弹出模态框（URL 仍为 `/photo/1`）

## 5. Route Handlers

```ts
// app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const users = await db.query('SELECT * FROM users');
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = await db.insert('users', body);
  return NextResponse.json(user, { status: 201 });
}
```
