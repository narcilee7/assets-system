# 边缘渲染

## 1. 边缘计算 vs 传统 SSR

```
传统 SSR：
用户(北京) → DNS → CDN(北京) → 源站(上海/美国)
                             └─ 渲染 HTML
                              延迟：50-200ms

边缘 SSR：
用户(北京) → DNS → Edge Worker(北京 CDN 节点)
                    └─ 直接在边缘渲染 HTML
                     延迟：< 20ms
```

| 特性 | 传统 SSR | 边缘 SSR |
|------|---------|---------|
| 运行位置 | 数据中心 | CDN 边缘节点 |
| 延迟 | 50-200ms | < 20ms |
| 冷启动 | 慢（秒级） | 快（毫秒级） |
| 运行时限制 | 无 | CPU/内存有限 |
| 数据库连接 | 直接 | 需 Edge-compatible DB |
| 成本 | 高（持续运行） | 低（按请求计费） |

## 2. Vercel Edge

```javascript
// Next.js Edge Runtime
// app/page.tsx
export const runtime = 'edge';  // 使用 Edge Runtime

export default async function Page() {
  // 在边缘节点执行
  const data = await fetch('https://api.example.com/data', {
    // 自动使用边缘缓存
    next: { revalidate: 60 }
  });

  return <div>{/* render */}</div>;
}

// Edge API Route
export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  // 在边缘执行搜索
  const results = await fetch(`https://search-api.com?q=${query}`);

  return new Response(JSON.stringify(await results.json()), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## 3. Cloudflare Workers

```javascript
// worker.ts
export interface Env {
  CACHE: Cache;
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. 检查缓存
    const cacheKey = new Request(url.toString(), request);
    const cached = await env.CACHE.match(cacheKey);
    if (cached) return cached;

    // 2. 从 D1 数据库获取数据
    const { results } = await env.DB.prepare(
      'SELECT * FROM posts WHERE slug = ?'
    ).bind(url.pathname.slice(1)).all();

    // 3. 渲染 HTML
    const html = renderHTML(results[0]);

    // 4. 缓存响应
    const response = new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60',
      },
    });

    await env.CACHE.put(cacheKey, response.clone());
    return response;
  },
};

// wrangler.toml
name = "my-ssr-app"
main = "worker.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "xxx"
```

## 4. 边缘缓存策略

```javascript
// Stale-While-Revalidate 边缘缓存
export async function GET(request) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, request);

  // 尝试获取缓存
  let response = await cache.match(cacheKey);

  if (!response) {
    // 缓存未命中，渲染并缓存
    response = await renderAndCache(request, cache, cacheKey);
  } else {
    // 缓存命中，后台更新（SWR）
    const age = parseInt(response.headers.get('age') || '0');
    const maxAge = 60;

    if (age > maxAge) {
      // 异步更新缓存，不阻塞当前请求
      event.waitUntil(renderAndCache(request, cache, cacheKey));
    }
  }

  return response;
}

async function renderAndCache(request, cache, cacheKey) {
  const html = await renderPage(request);
  const response = new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=60',
    },
  });
  await cache.put(cacheKey, response.clone());
  return response;
}
```

## 5. 边缘数据库选型

| 数据库 | 类型 | 边缘兼容 | 适用场景 |
|--------|------|---------|---------|
| **Cloudflare D1** | SQLite | ✅ | 小型应用、配置数据 |
| **Cloudflare KV** | Key-Value | ✅ | 缓存、会话、配置 |
| **PlanetScale** | MySQL | ✅ | 关系型数据、大规模 |
| **Turso** | SQLite | ✅ | 边缘原生、全球复制 |
| **FaunaDB** | Document | ✅ | 复杂查询、事务 |
| **Upstash Redis** | KV/Cache | ✅ | 缓存、实时数据 |
