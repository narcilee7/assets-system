# Nuxt Nitro Engine

## 1. Nitro 是什么

Nuxt 3 的底层服务端引擎，也是 Nuxt 的构建系统：
- **Universal 服务器**：支持 Node.js、Deno、Cloudflare Workers、Vercel Edge 等
- **自动路由**：`server/api/` 和 `server/routes/` 自动映射为 API 路由
- **代码分割**：自动按路由分割服务端代码
- **存储层**：统一的存储抽象（KV、Redis、文件系统等）

## 2. 项目结构

```
project/
├── nuxt.config.ts
├── app.vue
├── pages/                  # 页面路由
│   └── index.vue
├── components/             # 自动导入组件
├── composables/            # 自动导入组合式函数
├── server/                 # Nitro 服务端代码
│   ├── api/                # API 路由 (/api/*)
│   │   ├── users.get.ts    # GET /api/users
│   │   └── users.post.ts   # POST /api/users
│   ├── routes/             # 自定义路由
│   │   └── sitemap.xml.ts  # /sitemap.xml
│   ├── middleware/         # 服务端中间件
│   │   └── auth.ts
│   ├── plugins/            # Nitro 插件
│   └── utils/              # 服务端工具函数
└── nuxt.config.ts
```

## 3. API 路由

```ts
// server/api/users.get.ts
export default defineEventHandler(async (event) => {
  // event 包含 request/response 信息
  const query = getQuery(event);        // 查询参数
  const body = await readBody(event);   // 请求体 (POST)

  // 返回 JSON
  return {
    users: [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ],
  };
});

// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const user = await db.findUser(id);

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' });
  }

  return user;
});
```

## 4. 服务端中间件

```ts
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  // 排除公开路由
  if (event.path.startsWith('/api/public')) return;

  const token = getHeader(event, 'authorization');

  if (!token) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  // 验证 token
  const user = await verifyToken(token);
  event.context.auth = user;  // 将用户信息存入 context
});

// 在 API 路由中使用
export default defineEventHandler((event) => {
  const user = event.context.auth;
  return { message: `Hello ${user.name}` };
});
```

## 5. 存储层

```ts
// 使用 Nitro 存储层
export default defineEventHandler(async (event) => {
  // 获取存储实例
  const storage = useStorage();

  // 缓存数据
  const cached = await storage.getItem('users:list');
  if (cached) return cached;

  const users = await fetchUsers();

  // 存入缓存（可配置 Redis、FS、KV 等）
  await storage.setItem('users:list', users, { ttl: 3600 });

  return users;
});
```

## 6. 多平台部署

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'vercel-edge',  // 部署到 Vercel Edge
    // preset: 'cloudflare-pages',
    // preset: 'netlify',
    // preset: 'node-server',  // 默认
  },
});
```
