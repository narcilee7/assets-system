# API Design Checklist

## 目标

训练 API 设计的完整检查清单。涵盖 REST 风格、资源建模、错误模型、幂等性、分页、版本管理等核心维度。

## 核心维度

| 维度 | 检查点 |
| --- | --- |
| Resource Modeling | 资源划分、URL 命名、HTTP 方法 |
| Request / Response | DTO 设计、参数校验、分页、排序 |
| Error Model | 错误码、消息、结构、retryable 标识 |
| Idempotency | 幂等键、去重窗口、状态查询 |
| Versioning | URL vs Header、兼容性策略 |
| Security | 认证、授权、限流 |
| Observability | 请求 ID、错误日志、延迟指标 |

## REST 风格检查

- [ ] URL 使用名词复数：`/users` 而不是 `/getUsers`
- [ ] URL 使用 kebab-case：`/order-items` 而不是 `/orderItems`
- [ ] 嵌套资源限制在 2 层：`/users/{id}/orders/{id}`
- [ ] 查询参数用于过滤：`?status=pending&page=1`
- [ ] HTTP 方法语义正确：GET（查）、POST（创）、PUT（整更）、PATCH（部分）、DELETE（删）

## 请求设计检查

- [ ] 必填参数校验，缺少返回 400
- [ ] 分页使用 cursor 而非 offset（大数据集性能）
- [ ] 列表响应包含总数或 hasMore 标志
- [ ] 时间使用 ISO 8601 格式
- [ ] 枚举值使用字符串，不依赖底层数值

## 响应设计检查

- [ ] 成功：200/201/204，使用 resource 或 collection wrapper
- [ ] 错误：结构一致，包含 code、message、details
- [ ] 敏感数据脱敏或排除
- [ ] 大列表分页返回

## 错误模型检查

- [ ] 错误码全局唯一，便于搜索
- [ ] 消息对用户友好，不暴露内部细节
- [ ] 4xx 客户端错误不重试
- [ ] 5xx 服务端错误可重试（带幂等键）
- [ ] retryable 字段标识是否可重试

## 幂等性检查

- [ ] POST 请求使用幂等键避免重复创建
- [ ] 幂等键 TTL 设置合理（通常 24h-7d）
- [ ] 支付等高风险操作必须幂等
- [ ] 幂等冲突返回 409 或 200（取决于语义）

## 版本管理检查

- [ ] URL 版本：`/v1/users`
- [ ] 字段变更：添加可选字段，不删除不重命名
- [ ] 重大变更才升版本
- [ ] 旧版本有明确废弃时间

## 面试追问

- REST vs RPC 的取舍？
  （答：REST 更适合资源型 API，RPC 更适合动作型。混合使用也可以。）
- 什么时候用 POST vs PUT？
  （答：POST 创建（幂等性不强），PUT 创建或完整替换（幂等））
- 分页 cursor vs offset 的选择？
  （答：cursor 高性能，适合大数据集；offset 简单，适合小数据集）
- 错误消息该不该包含错误码？
  （答：应该，错误码便于搜索和对接）

## 相关模式

- `data-consistency/transaction-boundary/`：幂等键设计
- `reliability/stability-patterns/`：重试和超时
- `patterns/middleware-pipeline/`：请求处理管道