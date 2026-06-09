# Mock 服务

## 1. MSW（Mock Service Worker）

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ]);
  }),

  http.post('/api/login', async ({ request }) => {
    const body = await request.json();
    if (body.email === 'test@example.com') {
      return HttpResponse.json({ token: 'abc123' });
    }
    return new HttpResponse(null, { status: 401 });
  }),

  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'User ' + params.id });
  }),
];
```

```typescript
// mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// main.tsx
if (process.env.NODE_ENV === 'development') {
  const { worker } = await import('./mocks/browser');
  await worker.start();
}
```

## 2. 延迟模拟

```typescript
http.get('/api/slow', async () => {
  await delay(2000);  // 模拟 2 秒延迟
  return HttpResponse.json({ data: [] });
});
```
