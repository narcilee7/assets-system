# Node.js Architecture

## 架构模式

| 模式 | 场景 |
| --- | --- |
| BFF | 前端聚合、权限、降级 |
| API Gateway | 路由、鉴权、限流 |
| Modular Monolith | 中小后端系统 |
| Microservice | 独立部署和团队边界 |
| Event-driven | 异步任务和最终一致 |
| Serverless | 低运维、突发流量 |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Node.js BFF blueprint | `bff-blueprint/` | 服务聚合、降级中间件、缓存层 |
| API gateway with auth and rate limit | `api-gateway/` | Express + http-proxy-middleware + JWT + 限流 |
| modular NestJS architecture | *(见 `../frameworks/nestjs-blueprint`)* | 模块、分层、依赖注入 |
