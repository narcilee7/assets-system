# Node.js Frameworks

## 框架矩阵

| 框架 | 适合场景 | 关注点 |
| --- | --- | --- |
| Express | 简单 API、生态成熟 | 约束弱、需要自建规范 |
| Koa | 轻量中间件、洋葱模型 | 生态和工程约束 |
| NestJS | 企业级服务、模块化、DI | 学习成本、装饰器 |
| Fastify | 高性能 API、schema-first | 插件模型、序列化 |
| Hono | Edge / lightweight | runtime 差异 |
| Next API / Route Handler | 全栈应用、BFF | cache、runtime、边界 |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Express middleware architecture | `express-middleware/` | 中间件工厂、安全头、角色限流 |
| Koa onion model | `koa-onion/` | 洋葱模型、组合式中间件、日志 |
| NestJS modular service blueprint | `nestjs-blueprint/` | 模块、拦截器、异常过滤器、DTO |
| Fastify schema validation | `fastify-service/` | schema-first 路由、装饰器插件、错误处理 |
| Hono edge runtime | `hono-edge/` | Cloudflare Workers、Zod 校验、跨运行时 |
| Next.js API Routes | `nextjs-api-routes/` | App Router Route Handler、Streaming、Edge vs Node.js |
