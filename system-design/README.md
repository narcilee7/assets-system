# System Design

系统设计层把单点实现升级为可讲清楚的完整系统：需求、接口、数据、读写路径、扩展、失败路径、观测和权衡。

## 案例库

| 案例 | 目录 | 状态 | 训练目标 |
| --- | --- | --- | --- |
| 实时系统 | `realtime/` | ✅ done | SSE、WebSocket、心跳、重连、流式输出、断连恢复 |
| 缓存系统 | `cache/` | ✅ done | TTL、淘汰、一致性、穿透 / 击穿 / 雪崩、多级缓存 |
| 推荐系统 | `recommendation/` | ✅ done | 召回、排序、特征、反馈、冷启动 |
| Agent 平台 | `agent-platform/` | ✅ done | tool、memory、workflow、eval、权限、安全 |
| API 网关 | `api-gateway/` | ✅ done | 路由、认证、限流、熔断、协议转换、插件 |
| 大文件上传 | `file-upload/` | ✅ done | 分片、秒传、断点续传、合并、幂等 |
| 消息队列 | `queue/` | ✅ done | ack、retry、DLQ、顺序、幂等、事务消息 |
| 认证授权 | `auth/` | ⚠️ partial | session、JWT、RBAC、刷新、撤销（interview 待补） |
| 限流系统 | `rate-limiter/` | ⚠️ partial | token bucket、分布式限流（有 Go 实现，文档待扩） |
| 订单系统 | `order-system/` | ⚠️ partial | 库存预占、超时取消、状态机、防超卖（仅骨架） |
| 分布式 ID | `distributed-id/` | ⚠️ seeding | 雪花算法、号段模式、趋势递增、时钟回拨 |
| 分布式锁 | `distributed-lock/` | ⚠️ seeding | Redis/DB/ZK 实现、看门狗、可重入、红锁 |
| 聊天系统 | `chat-system/` | ⚠️ seeding | 消息时序、已读回执、多端同步、消息漫游 |
| Feed 流 | `feed/` | ❌ seed | 推 / 拉、分页、去重、排序 |
| 支付系统 | `payment-system/` | ❌ seed | 幂等、对账、状态机、最终一致性、退款 |
| 通知系统 | `notification-system/` | ❌ seed | 多渠道推送、模板、限频、批量、送达率 |
| 可观测平台 | `observability/` | ❌ seed | log、metric、trace、告警 |
| 搜索系统 | `search/` | ❌ seed | indexing、query、ranking、更新 |
| 短链系统 | `short-url/` | ❌ seed | ID 生成、跳转、统计、防滥用 |
| 对象存储 | `object-storage/` | ❌ seed | 元数据、纠删码、分片、一致性、多租户 |

### 状态图例

- ✅ **done**：8 个 doc + interview ≥ 8 个追问 + 含 corner case 与生产踩坑
- ⚠️ **partial**：核心 doc 已有但 interview/深度不够
- ⚠️ **seeding**：补齐中（当前批次）
- ❌ **seed**：仅占位，待排期

### 缺失的高频案例（待立项）

| 缺失案例 | 优先级 | 理由 |
| --- | --- | --- |
| 分布式事务 | P0 | TCC/Saga/本地消息表，面试必问 |
| 秒杀系统 | P0 | 排队、独立库存、限流熔断、风控 |
| 配置中心 | P0 | Nacos/Apollo 模式，推拉、灰度、回滚 |
| 消息系统 | P1 | Kafka 分区、ISR、exactly-once |
| CDN | P1 | 边缘节点、回源、命中率 |
| 服务发现 | P1 | 一致性 hash、健康检查 |
| 在线协作 | P2 | CRDT/OT、富文本冲突 |
| 直播流 | P2 | 推流、转码、秒开 |
| 工作流引擎 | P2 | DAG 调度、补偿 |
| 地理多活 | P3 | 同城双活、异地多活 |
| Webhook | P3 | 签名、重试、订阅 |

## 固定输出结构

每个系统设计案例至少包含：

```text
docs/problem.md       # 需求、非功能目标、约束
docs/api.md           # API / event contract
docs/data-model.md    # 数据模型
docs/read-write.md    # 核心读写路径
docs/failure.md       # 失败模式和恢复
docs/scale.md         # 扩展方案和瓶颈
docs/observability.md # 指标、日志、追踪、告警
docs/interview.md     # 面试追问和权衡
implementation/       # 最小实现，可选
```

## 面试讲解顺序

```text
明确需求
-> 给出核心 API
-> 画核心流程
-> 说明数据模型
-> 分析瓶颈
-> 处理失败路径
-> 讲扩展和权衡
-> 总结观测指标
```

## 优先级

### 当前批次（进行中）

| 案例 | 动作 |
| --- | --- |
| 分布式 ID | 从 seed 补到 ✅ done |
| 分布式锁 | 从 seed 补到 ✅ done |
| 聊天系统 | 从 seed 补到 ✅ done |

### 历史批次（已完成）

| 案例 | 备注 |
| --- | --- |
| 实时系统 | 深度完成，作为后续 interview.md 的模板 |
| 缓存系统 | 深度完成 |
| 推荐系统 | 深度完成（interview 最长，560 行） |
| Agent 平台 | AI 全栈差异化核心 |
| API 网关 | 平台型系统高频 |
| 大文件上传 | 已有前端实现 + 完整 docs |
| 消息队列 | 完成 |

### 待启动批次

| 批次 | 案例 |
| --- | --- |
| 下一批（P0 必补） | 分布式事务、秒杀系统、配置中心 |
| 再下一批（P1） | 消息系统（Kafka）、CDN、服务发现 |
| 长期（P2/P3） | 在线协作、直播流、工作流、地理多活、Webhook |

### 优先级判定标准

1. 面试出现频率（5★最高）
2. 是否能凸显差异化（AI 全栈、Trading）
3. 是否能复用其他已完成的案例作为模板

