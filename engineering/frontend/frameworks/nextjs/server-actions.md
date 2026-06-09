# Next.js Server Actions

## 1. 基本概念

Server Action = 在服务端执行的函数，可以直接从 Client Component 调用。

```tsx
// app/actions.ts
'use server';  // 标记文件中的所有导出为 Server Action

import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  const title = formData.get('title');
  const content = formData.get('content');

  await db.insert('posts', { title, content });

  revalidatePath('/posts');  // 刷新缓存
}

export async function deletePost(id: string) {
  await db.delete('posts', id);
  revalidatePath('/posts');
}
```

```tsx
// app/posts/page.tsx
import { createPost } from './actions';

export default function PostsPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </form>
  );
}
```

## 2. Progressive Enhancement

```tsx
'use client';

import { useState } from 'react';
import { createPost } from './actions';

export function CreatePostForm() {
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await createPost(formData);
      // 成功后的客户端逻辑
    } catch (error) {
      // 错误处理
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <input name="title" disabled={pending} />
      <button type="submit" disabled={pending}>
        {pending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

**渐进增强**：
- **无 JS**：表单正常提交，页面刷新
- **有 JS**：拦截表单提交，用 fetch 调用 Server Action，无刷新更新

## 3. 错误处理与重定向

```tsx
'use server';

import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email');
  const password = formData.get('password');

  const user = await authenticate(email, password);

  if (!user) {
    return { error: 'Invalid credentials' };  // 返回错误信息
  }

  await createSession(user.id);
  redirect('/dashboard');  // 登录成功重定向
}
```

```tsx
'use client';

export function LoginForm() {
  const [state, formAction] = useFormState(login, null);

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit">Login</button>
    </form>
  );
}
```
