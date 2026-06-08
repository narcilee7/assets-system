# React Server Components (RSC)

## 1. 为什么需要 RSC

传统 React 应用的问题：
1. **Bundle 体积**：所有组件代码都打包到客户端
2. **数据获取瀑布**：客户端渲染 → 请求数据 → 子组件请求数据 → ...
3. **服务端渲染限制**：SSR 需要hydrate，无法访问服务端资源

RSC 的解决思路：**部分组件只在服务端运行，不打包到客户端**。

```
传统 SSR                         RSC
   │                              │
   │ 服务端渲染 HTML               │ 服务端运行 Server Components
   │ + 客户端 hydrate              │ 生成 RSC Payload
   │                              │
   │ 客户端运行所有组件            │ 客户端只运行 Client Components
   │                              │ + 解析 RSC Payload
   ▼                              ▼
  Bundle: 500KB                  Bundle: 150KB（仅 Client Components）
```

## 2. Server Component vs Client Component

| 特性 | Server Component | Client Component |
|------|------------------|------------------|
| 运行位置 | 服务端 | 客户端 |
| Bundle 中 | ❌ 不包含 | ✅ 包含 |
| 可以 `useState` | ❌ | ✅ |
| 可以 `useEffect` | ❌ | ✅ |
| 可以访问数据库 | ✅ | ❌ |
| 可以访问文件系统 | ✅ | ❌ |
| 可以访问浏览器 API | ❌ | ✅ |
| props 必须是 | 可序列化 | 任意 |

### 代码示例

```javascript
// ServerComponent.jsx（默认在服务端运行）
import { db } from './db';  // 直接访问数据库

export default async function UserList() {
  const users = await db.query('SELECT * FROM users');  // 服务端直接查询

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          <UserCard user={user} />  {/* 可以嵌套 Client Component */}
        </li>
      ))}
    </ul>
  );
}
```

```javascript
// ClientComponent.jsx（必须在客户端运行）
'use client';  // 标记为 Client Component

import { useState } from 'react';

export default function LikeButton({ userId }) {
  const [liked, setLiked] = useState(false);

  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? '♥' : '♡'}
    </button>
  );
}
```

## 3. RSC Payload（Flight Protocol）

Server Component 的输出不是 HTML，而是 **RSC Payload**——一种自定义的序列化格式：

```
M1:{"id":"./UserList","chunks":["chunk1.js"]}
J2:["$","div",null,{"children":["Hello ","$1",{"name":"Alice"}]}]
S3:"$Sreact.suspense"
```

- `M`：模块引用（用于代码分割和懒加载）
- `J`：JSX 元素（type, props, key）
- `S`：Suspense 边界
- `$1`：对之前元素的引用（类似 JSON 的引用机制）

### 序列化限制

Server Component 传给 Client Component 的 props 必须**可序列化**：

```javascript
// ✅ 可以传递
<UserCard user={{ id: 1, name: 'Alice' }} />

// ❌ 不能传递
<UserCard onClick={() => alert('hi')} />  // 函数不可序列化
<UserCard element={<div />} />             // JSX 元素在 RSC 中有限制
```

**解决方案**：把需要函数/事件处理器的部分提取为 Client Component。

## 4. Client/Server 边界设计

```
Page (Server)
    │
    ├── Layout (Server)
    │   ├── Nav (Server)          ← 纯展示，无交互
    │   │
    │   └── UserMenu (Client)     ← 需要 useState 管理下拉
    │
    ├── UserList (Server)
    │   └── map → UserCard (Client)  ← 每个卡片需要 LikeButton
    │
    └── Sidebar (Server)
        └── SearchBox (Client)    ← 需要输入交互
```

**设计原则**：
1. 默认所有组件都是 Server Component
2. 只有需要客户端交互（state、effect、浏览器 API）时才标记 `'use client'`
3. Server Component 可以 import Client Component，反之不行
4. 数据获取尽量在 Server Component 中完成

## 5. Next.js App Router 中的 RSC

```javascript
// app/page.js（默认是 Server Component）
import { Suspense } from 'react';
import UserList from './UserList';
import Loading from './loading';

export default async function Page() {
  // 直接在服务端获取数据
  return (
    <main>
      <h1>Users</h1>
      <Suspense fallback={<Loading />}>
        <UserList />  {/* 异步 Server Component */}
      </Suspense>
    </main>
  );
}
```

```javascript
// app/UserList.js（Server Component）
async function getUsers() {
  const res = await fetch('https://api.example.com/users', {
    next: { revalidate: 60 }  // ISR 缓存
  });
  return res.json();
}

export default async function UserList() {
  const users = await getUsers();

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## 6. RSC 的 Bundle 优势

```
页面：用户列表

传统 CSR/SSR：
  Bundle: React + ReactDOM + Router + StateManagement + UserList组件 + UserCard组件 + API客户端
  大小: ~300KB

RSC：
  Bundle: React + ReactDOM + 仅 Client Components (LikeButton, UserMenu)
  大小: ~80KB
  Server Components 在服务端运行，不进入 Bundle
```
