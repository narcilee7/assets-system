# Node.js API Design

## 主线

| 方向 | 关键点 |
| --- | --- |
| REST | resource、status、error、pagination |
| GraphQL | schema、resolver、N+1、DataLoader |
| RPC | tRPC、protobuf、contract |
| BFF | aggregation、permission、cache、fallback |
| Validation | zod、joi、class-validator |
| Error Model | code、details、retryable、trace id |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Node.js API error model | `error-model/` | AppError、结构化错误码、Express 全局错误中间件、asyncHandler |
| zod validation pipeline | `zod-pipeline/` | 通用校验中间件、业务 Schema、类型推导 |
| GraphQL BFF | `graphql-bff/` | Apollo Server、DataLoader N+1 解决、Resolver |
| tRPC router | `trpc-router/` | 端到端类型安全、Router、HTTP Handler、前端调用 |
