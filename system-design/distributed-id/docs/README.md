# Distributed ID Generator Docs

状态：**done**（2026-07 大修）

这个目录承载分布式 ID 生成器系统设计的完整文档，包括雪花算法、号段模式、Worker 分配、时钟回拨处理、混合模式等。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ done | 4 大功能需求（全局唯一/趋势递增/高性能/高可用）、非功能指标、约束、4 个关键决策、4 个真实踩坑 |
| api.md | ✅ done | 发号接口（HTTP/gRPC/SDK/批量/异步/本地嵌入）、管理接口（注册/心跳/下线）、反解接口、错误码、业务标签管理 |
| data-model.md | ✅ done | Worker 注册表、号段表、双 buffer 模型、雪花位分配、Redis 缓存、时钟回拨记录表、反解模型 |
| read-write.md | ✅ done | 雪花算法核心实现（含无锁优化）、号段双 buffer 异步预加载、混合模式、SDK 流程、故障模式读写 |
| failure.md | ✅ done | 7 大失败模式：时钟回拨、sequence 溢出、Worker 冲突、DB 不可用、号段浪费、跨机房时钟漂移、ID 重复 |
| scale.md | ✅ done | 容量规划（5W QPS/集群 1000W）、Worker 扩展、机房扩展、性能瓶颈（无锁/批量预生成）、未来挑战 |
| observability.md | ✅ done | 三大支柱 + 核心指标 + 结构化日志 + Trace + 告警规则 + 监控大盘 + 故障定位手册 + 容量预测 |
| interview.md | ✅ done | 8 个核心追问（位分配/时钟回拨/号段vs雪花/号段浪费/Worker分配/雪花vsUUID/降级方案/生产踩坑） |

## 核心知识点

### 雪花算法（Snowflake）

- 64-bit ID：`1 bit 符号 + 41 bit 时间戳 + 5 bit datacenter + 5 bit worker + 12 bit sequence`
- 优势：本地计算、趋势递增、可反解时间
- 劣势：时钟回拨敏感

### 号段模式（Segment）

- 从 DB 预加载号段（步长 step），内存中递增
- 优势：严格递增、DB 抖动兜底（双 buffer）
- 劣势：依赖 DB、有号段浪费

### 混合模式（Leaf 美团方案）

- 默认雪花，失败时切号段
- 取长补短

## 关键决策

| 决策点 | 推荐方案 | 原因 |
|--------|---------|------|
| 业务 ID 类型 | 雪花算法 | 性能高、可反解、MySQL 主键友好 |
| 时钟回拨 | 扩展 sequence + 报警 | 平衡延迟和唯一性 |
| Worker 分配 | DB 表 + UNIQUE 约束 | 简单可靠 |
| 号段步长 | step = QPS / 10 | 平衡 DB 压力和浪费 |
| JS 端支持 | BigInt / String | 64-bit 长期不安全 |
| 降级方案 | 客户端 UUID v7 / 业务侧缓存 | 应对 IDGen 故障 |

## 面试模板

按 README.md 中"面试讲解顺序"逐章讲解，重点突出：
1. **算法选型**：雪花 vs 号段 vs UUID 的取舍
2. **时钟问题**：雪花算法的根本弱点
3. **性能优化**：无锁、批量预生成、双 buffer
4. **降级方案**：IDGen 挂了业务怎么办
5. **生产踩坑**：sequence 溢出、号段浪费、时钟回拨
