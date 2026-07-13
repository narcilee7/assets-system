# Wandb / Weave 工程平台化：端到端系统设计

> 面向 AI Infra 面试的 Wandb & Weave 平台深度解析  
> 覆盖 SDK → Server → Frontend 全链路，聚焦数据模型、存储选型、扩展性与工程权衡  
> 版本：2026.07

---

## 1. 产品定位与边界

### 1.1 Wandb 是什么？

Wandb（Weights & Biases）是面向机器学习实验与模型生命周期的**实验追踪与协作平台**。核心能力：

- **Runs**：单次训练运行的元数据、指标、日志、配置、总结。
- **Metrics**：训练过程中随 step/epoch 变化的标量、直方图、媒体、表格。
- **Artifacts**：数据集、模型文件、检查点的版本化管理与血缘追踪。
- **Sweeps**：超参数搜索与自动调度。
- **Reports**：可嵌入 live charts 的协作文档。
- **Model Registry**：模型从 staging 到 production 的流转管理。
- **Launch**：从 Wandb UI 触发远程训练作业。

### 1.2 Weave 是什么？

Weave 是 Wandb 在 GenAI/Agent 时代的产物，专注：

- **Tracing**：用 `@weave.op()` 自动捕获 LLM/Agent 调用链（inputs、outputs、latency、cost、tokens）。
- **Evaluation**：基于 dataset + scorer 的离线评估框架。
- **Feedback**：人工或 LLM judge 对 trace 打标签。
- **Datasets**：版本化的评估数据集。

### 1.3 Wandb 与 Weave 的关系

| 维度 | Wandb | Weave |
|---|---|---|
| 核心对象 | Run / Metric / Artifact | Call / Op / Trace / Evaluation |
| 数据形态 | 时序指标 + 大文件 | 结构化调用树 + 嵌套 span |
| 存储引擎 | MySQL（元数据）+ S3（文件）+ TSDB（时序指标） | ClickHouse（trace server） |
| 用户场景 | 传统 ML 实验管理 | LLM/Agent 可观测与评估 |
| 关系 | 数据层逐步互通，Weave 项目可复用 Wandb Project/Team | 可独立部署，也可嵌入 Wandb Cloud |

### 1.4 竞品对照

| 产品 | 强项 | 弱项 |
|---|---|---|
| **Wandb** | 实验追踪生态完整、Artifacts 血缘、社区大 | GenAI tracing 起步晚于专门工具 |
| **MLflow** | 开源、模型注册成熟、Databricks 集成 | UI/UX、实时性、协作弱于 Wandb |
| **Neptune** | 轻量、高基数指标处理较好 | 生态与社区规模较小 |
| **LangSmith** | LLM tracing 原生、与 LangChain 深度集成 | 绑定 LangChain 生态 |
| **Langfuse** | 开源 LLM observability | 企业功能与生态尚在成长 |
| **Phoenix** | 开源、RAG/LLM eval 强 | 企业级功能较少 |

---

## 2. 端到端架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client SDK                                  │
│   Python / JS / CLI / Jupyter                                            │
│   wandb.init() · log() · save() · Artifact() · @weave.op()              │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS / WebSocket
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Gateway                                    │
│   REST / GraphQL / gRPC                                                  │
│   Auth · Rate Limit · Routing · WSS Push                                │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Metadata DB  │      │   File Store    │      │  Trace Server   │
│  MySQL / PG   │      │   S3 / GCS      │      │   ClickHouse    │
│               │      │                 │      │                 │
│ · runs        │      │ · artifacts     │      │ · calls         │
│ · projects    │      │ · media files   │      │ · traces        │
│ · users/teams │      │ · checkpoints   │      │ · evaluations   │
│ · sweeps      │      │ · manifests     │      │ · feedback      │
└───────┬───────┘      └─────────────────┘      └─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Stream / Job Layer                               │
│   Kafka / Kinesis · Celery / SQS · Sweep Controller · Launch Scheduler  │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                                │
│   Dashboard · Runs Table · Charts · Reports · Weave Traces · Registry   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 一次 `wandb.log()` 的完整数据流

```
1. 用户调用 wandb.log({"loss": 0.5}, step=100)
2. SDK 本地序列化，写入 .wandb 文件或内存缓冲区
3. 后台独立进程（wandb-service）异步读取缓冲
4. 压缩并批量 POST 到 /files/{run_id}/file_stream
5. Server 解析后写入：
   - MySQL：run metadata、summary、config
   - TSDB / MySQL：metric history
   - S3：大文件（media、tables）
6. Frontend 通过 GraphQL 查询或 WebSocket 订阅更新
7. Dashboard 实时渲染折线图
```

### 2.3 控制流示例：创建 Run

```
1. SDK 发送 POST /runs 携带 project、config、tags
2. Server 在 MySQL 创建 run 记录，分配 run_id
3. Server 返回 run_id、display_name、base_url
4. SDK 启动本地 file_stream uploader 与 system monitor
5. Frontend 订阅 run 状态，展示 "running"
```

---

## 3. SDK 设计

### 3.1 `wandb.init()` 生命周期

```
login / api_key validation
    │
    ▼
create or resume run
    │
    ▼
spawn wandb-service subprocess        # 关键设计：隔离用户主进程
    │
    ▼
start file_stream sync thread
    │
    ▼
start system metrics monitor (GPU/CPU/内存)
    │
    ▼
return Run 对象给用户代码
```

**为何用独立子进程？**

- 避免网络 I/O 阻塞训练主循环。
- 训练崩溃时仍可 flush 缓冲数据。
- 统一处理重连、退避、认证刷新。

### 3.2 `wandb.log()` 本地缓冲与上传

- **缓冲策略**：按时间窗口（默认几秒）或 buffer 大小批量聚合。
- **序列化**：支持标量、直方图、图像、音频、视频、表格、3D 点云。
- **冲突解决**：同一 step 重复 log 同 key，后端按时间戳覆盖或追加。
- **离线模式**：`WANDB_MODE=offline` 时写入本地 `wandb/` 目录，后续 `wandb sync` 上传。

### 3.3 Config vs Summary

- **Config**：训练前/开始时确定的超参数，只读为主，可嵌套字典。
- **Summary**：运行结束时或运行中聚合的最终指标（如 best accuracy），可手动更新。

### 3.4 Weave SDK 核心

```python
import weave

weave.init("my-project")

@weave.op()
def generate(prompt: str) -> str:
    return call_llm(prompt)

# 每次调用自动生成 trace call
response = generate("What is LLM?")
```

- `@weave.op()` 会包装函数，记录 inputs/outputs/latency/cost。
- 自动捕获嵌套调用，构建 trace tree。
- 支持手动 feedback：`weave.feedback("call_id", {"correctness": 1})`。

---

## 4. Server 设计

### 4.1 API Gateway

- **GraphQL**：Wandb Public API 的主要形态，适合复杂查询（runs、artifacts、reports）。
- **REST**：文件上传、stream endpoint、认证。
- **WebSocket**：实时 push metric 更新到前端。
- **gRPC**：内部服务间通信（可选）。

### 4.2 Metadata DB（MySQL）

Wandb Self-Managed 官方使用 MySQL 存储元数据。核心表：

| 表 | 作用 |
|---|---|
| `users` / `teams` | 用户、团队、权限 |
| `projects` | 项目归属、可见性 |
| `runs` | run 元数据、state、config、summary |
| `sweeps` | sweep 配置、调度状态 |
| `artifacts` | artifact 元数据、version、type |
| `artifact_manifests` | 文件清单、digest |
| `artifact_lineage` | input/output artifact 关系 |

**为什么不把 metrics 也全放 MySQL？**

- Metrics 是**高写入、高基数时序数据**，MySQL 难以支撑 millions of runs × thousands of metrics 的时序查询。
- 需要专用时序存储或分表/分片策略。

### 4.3 Metrics 存储选型

| 方案 | 优点 | 缺点 |
|---|---|---|
| **MySQL 分表** | 简单、事务一致 | 高基数下查询慢、扩展性差 |
| **TimescaleDB** | PG 兼容、自动分区、时序优化 | 仍需维护 PG 集群 |
| **ClickHouse** | 列式、高压缩、聚合快 | 最终一致、单点写入压力大 |
| **InfluxDB / Prometheus** | 专为时序设计 | 与现有元数据打通成本高 |

**推荐**：元数据在 MySQL，metrics 在 TimescaleDB 或 ClickHouse，按 `(project_id, run_id, key)` 分片。

### 4.4 File Store（S3）

- **前缀设计**：`s3://{bucket}/{team}/{project}/{run_id}/files/...`
- **Artifact Storage**：content-addressable，按文件 digest 去重。
- **Multipart Upload**：大模型 checkpoint 分片上传，支持断点续传。
- **生命周期策略**：旧 media 转冷存，过期删除。

### 4.5 Trace Server（ClickHouse）

Weave 的 trace server 使用 ClickHouse，原因：

- **列式存储**：适合 trace 的半结构化 JSON 与大量 span。
- **高压缩**：trace 字段重复度高（op name、project）。
- **快速聚合**：按 op、latency、cost 分组分析。

核心表：

| 表 | 内容 |
|---|---|
| `calls` | 每次 op 调用：id、op_name、inputs、outputs、parent_id、latency、cost |
| `ops` | op 定义：name、signature、version |
| `feedback` | 人工/LLM 反馈：call_id、type、payload |
| `evaluations` | eval 结果：dataset_ref、scorer、score |

### 4.6 Multi-Tenancy

- **Workspace / Team**：所有资源归属 team，DB 行带 `team_id`。
- **Project 隔离**：run、artifact、trace 按 `project_id` 分片。
- **RLS（Row-Level Security）**：查询自动附加 `team_id` 过滤。
- **资源配额**：单 team 的 storage、request rate、concurrent runs 限制。

---

## 5. Frontend 设计

### 5.1 技术栈

- **React / TypeScript**：主流选择。
- **GraphQL Client（Apollo / Relay）**：按需拉取 runs、metrics、artifacts。
- **Virtualized Table**：runs 数量可达百万，必须虚拟滚动。
- **Charting**：Vega-Lite / Recharts / 自研 canvas 渲染。

### 5.2 Runs Table

- 过滤：config、tags、state、created_at、sweep。
- 排序：按任意 metric summary。
- 分页：cursor-based pagination。
- 视图保存：用户自定义列与过滤器持久化。

### 5.3 Charts

- **Metric History**：按 step 或 wall time 绘制，支持对数轴、平滑。
- **Parallel Coordinates**：超参与指标关系。
- **Confusion Matrix / ROC**：分类任务。
- **实时更新**：WebSocket 推送新数据点。

### 5.4 Weave Traces UI

- **Trace Tree**：嵌套调用可视化，支持折叠/展开。
- **Latency Waterfall**：每个 op 的耗时占比。
- **Feedback Panel**：对 call 打分、标注。
- **Eval Comparison**：并排对比不同 model/scorer 的 eval 结果。

---

## 6. 核心子系统深挖

### 6.1 Runs & Metrics

#### Run 状态机

```
created → running → finished
   │         │
   │         └─→ crashed
   │         └─→ killed
   └─→ resumed
```

#### Metrics 数据模型

```json
{
  "run_id": "abc123",
  "key": "train/loss",
  "step": 100,
  "value": 0.5,
  "timestamp": 1690000000.0
}
```

#### 高基数处理

- ** downsampling**：图表渲染时对老数据做 LTTB / min-max 降采样。
- **retention policy**：旧 metric 按天/周聚合，保留统计量而非原始点。
- **sampling logging**：用户可配置只 log 每 N step。

### 6.2 Artifacts

#### Artifact 数据模型

```json
{
  "name": "dataset-v1",
  "type": "dataset",
  "version": "v3",
  "metadata": {"num_samples": 100000},
  "manifest": {
    "files": [
      {"path": "train.jsonl", "digest": "sha256:abc...", "size": 12345}
    ]
  }
}
```

#### Lineage

```
Dataset v1 ──→ Train Run A ──→ Model Checkpoint v1 ──→ Eval Run B
                                     │
                                     ▼
                              Model Registry v1
```

### 6.3 Sweeps

#### 架构

```
Wandb UI / CLI
      │
      ▼
Sweep Controller (cloud)
      │
      ▼
Sweep Agent (user machine / cluster)
      │
      ▼
Training Workers
```

- **Controller**：维护搜索状态、选择下一组超参、early stopping 决策。
- **Agent**：轮询 Controller，启动训练进程，上报结果。
- **Worker**：普通 Wandb Run，参与 sweep。

### 6.4 Model Registry

- Model = Artifact + metadata（framework、metrics、stage）。
- Stage 流转：none → staging → production → archived。
- 与 CI/CD 集成：通过 Wandb API 查询 production model，触发部署。

### 6.5 Weave

#### Trace 数据模型

```json
{
  "id": "call-001",
  "op_name": "generate",
  "project_id": "proj-123",
  "trace_id": "trace-001",
  "parent_id": null,
  "inputs": {"prompt": "..."},
  "outputs": {"response": "..."},
  "latency_ms": 250,
  "cost_usd": 0.002,
  "tokens": {"input": 100, "output": 50},
  "started_at": 1690000000,
  "ended_at": 1690000250
}
```

#### Evaluation 流程

```
Dataset → Scorer → Model Prediction → Score → Weave Dashboard
            ↑
    LLM-as-judge / Rule / Embedding
```

---

## 7. 工程挑战与实现细节

### 7.1 实时性

- SDK 缓冲窗口：默认 2 秒或 10MB，平衡实时性与请求数。
- WebSocket/SSE：前端订阅 run 更新，减少轮询。
- Metric 聚合：服务端预聚合 common metrics，加速 dashboard 加载。

### 7.2 扩展性

- **Horizontal Scaling**：API Gateway 无状态，可水平扩展。
- **DB Sharding**：按 team_id 或 project_id 分片。
- **Read Replicas**：MySQL / ClickHouse 读副本分担 dashboard 查询。
- **CDN**：artifact 下载走 CDN，减轻 S3 出口。

### 7.3 一致性

- **Artifact Manifest**：上传文件后更新 manifest，用事务保证。
- **Run State**：state 转换用 CAS（compare-and-swap）避免并发覆盖。
- **Distributed Run**：multi-node training 只由 rank 0 上报 metrics。

### 7.4 成本

- **S3 分层**：旧 artifact 转 Glacier / 冷存。
- **Metric Retention**：7 天原始 + 1 年聚合。
- **Deduplication**：artifact 文件按 digest 去重。
- **Sampling**：高吞吐场景只采样 log。

### 7.5 安全

- **API Key**：user-level 与 team-level，支持 rotate。
- **SSO/SAML**：企业版支持。
- **Audit Log**：记录关键操作（delete artifact、change model stage）。
- **PII Scrubbing**：config 和 log 中检测并脱敏敏感信息。

### 7.6 离线场景

```bash
export WANDB_MODE=offline
python train.py
wandb sync wandb/offline-run-*
```

- 本地写入 `.wandb` 文件与 S3 文件缓存。
- `wandb sync` 扫描本地目录，按 run 批量上传。

---

## 8. 典型面试考点速览

| 层级 | 考点 |
|---|---|
| SDK | `init()` 子进程设计、`log()` 缓冲与离线模式、Artifact 版本化 |
| Server | Metadata DB vs Metrics Store、S3 前缀与去重、ClickHouse trace |
| Frontend | Runs Table 虚拟滚动、Charts 实时更新、Trace Tree 渲染 |
| 工程 | 多租户隔离、高基数 metrics、成本优化、一致性 |
| 开放设计 | 设计 metrics backend、设计 trace server、10M runs 成本优化 |

---

## 9. 关键数字

| 数字 | 含义 |
|---|---|
| 2s / 10MB | SDK 默认 flush 窗口 |
| 10M+ | Wandb 社区用户规模 |
| MySQL | Wandb Self-Managed 元数据存储 |
| ClickHouse | Weave trace server 存储 |
| S3 / GCS | Artifact 与媒体文件存储 |
| GraphQL | Wandb Public API 主形态 |
| 3 | Artifact stage：staging / production / archived |
| 4 | Sweep 组件：Controller / Agent / Worker / Scheduler |

---

## 10. 一句话定义

1. **Wandb 平台架构**：以 SDK 子进程异步上传为入口，GraphQL/REST 为 API，MySQL 存元数据、专用时序库存指标、S3 存文件，React 前端做实验可视化的多租户 ML 协作平台。

2. **Weave 架构**：基于 `@weave.op()` 自动插桩，调用链写入 ClickHouse trace server，前端以 trace tree 和 eval dashboard 形式展示 LLM/Agent 行为与评估结果的可观测平台。

3. **平台化核心挑战**：在 millions of runs、billions of metrics、billions of traces 的规模下，平衡实时性、一致性、多租户隔离与存储成本。

---

*更详细的面试题集见 [interview.md](interview.md)。*
