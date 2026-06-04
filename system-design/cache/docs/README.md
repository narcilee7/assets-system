# Cache System DOCS

状态：**draft**（深度完成）

这个目录承载缓存系统设计的完整文档，包括问题定义、API、数据模型、读写路径、失败模式、扩展、可观测和面试追问。

## 文档清单

| 文档 | 状态 | 说明 |
|------|------|------|
| problem.md | ✅ draft | 4 种读写模式（Cache Aside/Read Through/Write Through/Write Behind）、淘汰策略（LRU/LFU/TTL）、TTL 设计原则、4 个关键决策（缓存位置/key 设计/容量/一致性）、4 个真实踩坑案例 |
| api.md | ✅ draft | 基础 GET/SET、批量操作、缓存模式 API（Cache Aside/Write Behind）、TTL/原子操作/Hash、管理面 API（预热/清理/统计）、Event Contract |
| data-model.md | ✅ draft | Key 命名规范、Redis 数据结构选择（String/Hash/List/Set/ZSet/Stream）、多级缓存结构、LRU/LFU 实现、热点分散、分布式锁、REDIS INFO 指标 |
| read-write.md | ✅ draft | Cache Aside 详细实现、Write Behind（异步批量写）、Read Through、多级缓存读写、热 key 保护（singleflight/热点永不过期/分布式锁）、缓存预热 |
| failure.md | ✅ draft | 8 种失败模式：缓存穿透（布隆过滤/NULL 缓存）、缓存击穿（singleflight/永不过期/锁）、缓存雪崩（TTL jitter/预热/熔断）、热 key 问题、DB 不一致、大 key、内存打满、连接池耗尽 |
| scale.md | ✅ draft | 性能目标、5 个核心瓶颈（Redis QPS/热 key/大 key/击穿/容量）及优化方案、容量规划（QPS/内存/吞吐量）、监控指标 |
| observability.md | ✅ draft | 三大支柱（Logs/Metrics/Traces）、命中率/延迟/Redis 指标、告警规则、SLO 监控 |
| interview.md | ✅ draft | 8 个核心追问（读写模式选型/穿透击穿雪崩/一致性/热 key/淘汰策略/内存打满/高可用/生产踩坑） |
