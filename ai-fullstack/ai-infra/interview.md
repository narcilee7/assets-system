# Wandb / Weave 面试题集

> 面向 AI Infra / ML Platform 校招与社招面试  
> 难度分层：L1 基础 → L4 开放设计

---

## L1 基础理解

### L1-1 Wandb 是什么？解决什么问题？
- ML 实验追踪与协作平台，记录 runs、metrics、configs、artifacts。
- 解决实验可复现性差、结果分散、团队协作困难的问题。
- 核心对象：Run、Project、Metric、Artifact、Sweep、Report、Model Registry。

### L1-2 Weave 与 Wandb 的区别？
- Wandb 面向传统 ML 实验；Weave 面向 LLM/Agent tracing、evaluation、feedback。
- Wandb 核心对象是 Run/Metric；Weave 核心对象是 Call/Op/Trace/Evaluation。
- Weave trace server 通常用 ClickHouse；Wandb 元数据用 MySQL。

### L1-3 Wandb 与 MLflow 的主要差异？
- Wandb：实时 dashboard、Artifacts 血缘、Sweeps、社区生态更强。
- MLflow：开源、模型注册成熟、与 Databricks 深度集成，但实时性与 UX 较弱。

### L1-4 `wandb.init()` 做了什么？
- 验证 API key，创建或恢复 run。
- 启动独立后台进程（wandb-service）负责异步上传。
- 启动系统监控（GPU/CPU/内存）。
- 返回 Run 对象。

---

## L2 架构设计

### L2-1 描述一次 `wandb.log()` 的完整数据流。
- SDK 本地序列化并写入缓冲区/`.wandb` 文件。
- 后台进程批量读取、压缩、HTTP POST 到 server。
- Server 解析后写入 MySQL（metadata）、时序存储（metrics）、S3（大文件）。
- Frontend 通过 GraphQL/WebSocket 拉取/推送更新。

### L2-2 为什么 Wandb SDK 用独立子进程做上传？
- 避免网络 I/O 阻塞训练主循环。
- 训练崩溃时仍能 flush 缓冲数据。
- 统一处理重连、退避、认证刷新。

### L2-3 Wandb 的 Metadata DB 为什么用 MySQL？Metrics 为什么不也放 MySQL？
- MySQL 适合事务型元数据（users、teams、projects、runs、artifacts）。
- Metrics 是高写入、高基数时序数据，MySQL 难以支撑大规模时序查询。
- Metrics 更适合 TimescaleDB/ClickHouse 等时序/列式存储。

### L2-4 Artifact 如何实现版本化与去重？
- Artifact 按 `name:version` 管理，每次新增产生新版本。
- Manifest 列出文件路径与 digest。
- 文件存储采用 content-addressable storage，相同 digest 只存一份。

### L2-5 Weave 的 `@weave.op()` 如何工作？
- 装饰器包装函数，拦截调用。
- 记录 inputs、outputs、latency、cost、tokens。
- 自动关联 parent_id，构建 trace tree。
- 数据异步发送到 Weave trace server（ClickHouse）。

---

## L3 工程实现

### L3-1 设计 Wandb 的 Metrics 存储后端。
- 元数据在 MySQL，metrics 在 TimescaleDB/ClickHouse。
- 按 `(project_id, run_id, key, step)` 建模。
- 高基数处理：降采样、预聚合、TTL、采样 logging。
- 查询优化：按时间分片、索引 `(run_id, key, step)`。

### L3-2 Wandb 多租户如何实现数据隔离？
- 所有资源带 `team_id` / `project_id` 外键。
- API key 绑定 user/team，请求时注入身份上下文。
- 查询层统一加 RLS 过滤。
- 资源配额：storage、rate limit、concurrent runs。

### L3-3 Frontend Runs Table 有百万级 runs，如何设计？
- 虚拟滚动（react-window / react-virtualized）。
- Cursor-based pagination，避免 deep offset。
- 后端预聚合 summary metrics，避免实时计算。
- 过滤/排序下推到数据库索引。

### L3-4 如何保证 Artifact 文件与 Manifest 一致性？
- 上传文件完成后再更新 manifest 记录。
- 用事务包裹 manifest update。
- 后台 checksum 校验任务比对 manifest 与实际文件。
- 删除 artifact 时先标记 deleted，GC 异步清理。

### L3-5 Weave trace server 为什么选 ClickHouse？
- 列式存储适合半结构化 trace 数据。
- 高压缩比，适合大量重复字段（op_name、project_id）。
- 聚合查询快，适合 latency/cost 分析。
- 可水平扩展，支持高吞吐写入。

### L3-6 离线模式下 Wandb 如何工作？
- `WANDB_MODE=offline` 关闭网络上传。
- SDK 写入本地 `wandb/` 目录（`.wandb` 文件 + 缓存文件）。
- 训练结束后 `wandb sync` 扫描本地 run 并批量上传。
- 适合 air-gapped 环境或网络不稳定场景。

---

## L4 开放设计

### L4-1 如果让你从零设计 Wandb 的 metrics backend，支持 10M runs、每 run 10K metrics，你会怎么设计？
- 写入层：SDK 批量压缩上传，服务端 Kafka 削峰。
- 存储层：
  - 热数据：ClickHouse 最近 7 天原始点。
  - 温数据：按小时预聚合的统计量。
  - 冷数据：S3 Parquet，按需查询。
- 查询层：根据时间范围自动选择数据源；图表渲染用降采样。
- 成本：按 team 设置 retention、TTL、采样率。
- **追问**：如何保证实时性？如何支持任意 metric key 的 ad-hoc 查询？

### L4-2 设计一个 LLM Agent 的 trace server，需要支持哪些核心能力？
- 调用链捕获：op id、parent_id、trace_id、inputs/outputs。
- 性能指标：latency、tokens、cost、model name。
- 嵌套关系：tool call、retrieval、LLM call 的层级。
- 评估与反馈：attach score/feedback 到 call。
- 查询：按 trace、op、time、metadata 过滤；trace tree 可视化。
- **追问**：trace 数据量爆炸时如何采样和降成本？

### L4-3 Wandb 如何在保证实时 dashboard 的同时控制存储成本？
- 原始 metrics 保留短周期（如 7 天）。
- 自动降采样：老数据保留 min/max/mean，丢弃中间点。
- 用户可配置 log frequency，避免每 step 都写。
- Artifact 生命周期：旧版本转冷存或删除。
- 按 team/project 设置配额和保留策略。
- **追问**：用户想查看一年前某个 metric 的原始曲线怎么办？

### L4-4 如果 Wandb 要支持 10 倍流量增长，哪些模块需要优先扩容？
- API Gateway：无状态，水平扩展。
- File Stream / Upload：增加 upload workers，S3 multipart 优化。
- Metrics Store：ClickHouse/TimescaleDB 分片或增加节点。
- Frontend 查询：读副本、CDN、预聚合。
- Job Queue：Sweep/Launch 的 scheduler 独立扩展。
- **追问**：扩容时如何避免单点瓶颈？

### L4-5 设计一个支持私有化部署的 Wandb/Weave 平台，关键考虑是什么？
- 数据驻留：metadata、files、traces 都落在客户 VPC。
- 身份集成：SSO/SAML/LDAP、RBAC。
- 网络隔离：支持 VPC peering、private endpoint、air-gapped。
- 运维简化：K8s Operator 一键部署、备份恢复、监控告警。
- 多租户：single-tenant vs multi-tenant 部署模式。
- **追问**：如何平衡 SaaS 功能更新与私有化版本稳定性？

---

## 追问方向总结

面试官常深挖的点：

1. **数据模型**：Run / Metric / Artifact / Call 的字段与关系。
2. **存储选型**：为什么 MySQL + S3 + ClickHouse 这个组合？
3. **实时性**：SDK 缓冲、WebSocket、聚合策略。
4. **扩展性**：分片、读写分离、CDN。
5. **一致性**：manifest、state、distributed run。
6. **成本**：retention、dedup、降采样、冷存。
7. **安全**：API key、RBAC、audit、PII。
8. **开放设计**：给定规模或约束，从头设计子系统。

---

## 应答框架

遇到 Wandb/Weave/ML Platform 设计题时，按以下结构回答：

1. **定位需求**：是传统 ML 还是 LLM/Agent？规模多大？实时性要求？
2. **模块划分**：SDK / Server / Storage / Frontend / Queue。
3. **数据流**：从用户调用到持久化的完整链路。
4. **存储选型**：元数据、时序、文件、trace 分别用什么，为什么。
5. **关键机制**：versioning、multi-tenancy、offline、real-time push。
6. **失败路径**：网络中断、上传失败、并发冲突、数据丢失。
7. **成本与扩展**：retention、sharding、caching、CDN。
8. **安全与合规**：isolation、audit、data residency。
