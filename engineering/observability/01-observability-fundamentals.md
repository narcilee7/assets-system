# 可观测性基础

## 1. 三大支柱

```
可观测性三大支柱

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Metrics   │     │    Logs     │     │   Traces    │
│   指标       │     │    日志     │     │   追踪      │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ 聚合数值     │     │ 离散事件    │     │ 请求链路     │
│ 可聚合       │     │ 不可聚合    │     │ 可关联       │
│ 时间序列     │     │ 文本/结构化 │     │ 有向无环图   │
│ 高效存储     │     │ 高基数      │     │ 高维度       │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     └────────────────────┼────────────────────┘
                          ▼
                   ┌─────────────┐
                   │  Correlation │
                   │  关联分析    │
                   │  (TraceID + │
                   │   Timestamp) │
                   └─────────────┘

Metrics 回答：系统是否健康？
├── 请求速率：QPS
├── 错误率：Errors / Total
├── 延迟：P50 / P95 / P99
└── 资源使用：CPU / Memory / Disk

Logs 回答：发生了什么？
├── 请求详情：参数、响应、耗时
├── 错误详情：堆栈、上下文
├── 审计记录：谁做了什么
└── 调试信息：程序状态

Traces 回答：问题在哪里？
├── 请求路径：A → B → C → D
├── 每段耗时：服务间调用延迟
├── 依赖关系：服务调用拓扑
└── 错误定位：哪个服务失败
```

## 2. 信号类型扩展

```
超越三大支柱：四种信号

┌─────────────┐
│  Metrics    │  ← "what"（什么指标异常）
├─────────────┤
│   Logs      │  ← "why"（为什么发生）
├─────────────┤
│  Traces     │  ← "where"（问题在哪）
├─────────────┤
│  Profiles   │  ← "which code"（哪行代码）
└─────────────┘

Profiles（性能分析）
├── CPU Profile：哪些函数消耗 CPU
├── Memory Profile：哪些对象占用内存
├── Goroutine Profile：协程数量和状态
├── Block Profile：阻塞等待的代码
└── Mutex Profile：锁竞争热点
```

## 3. 可观测性 vs 监控

| 维度 | 监控（Monitoring） | 可观测性（Observability） |
|------|-------------------|--------------------------|
| 目标 | 知道系统是否坏了 | 理解系统为什么坏了 |
| 数据 | 预定义的指标 | 任何可以输出的信号 |
| 查询 | 预置的 Dashboard | 探索性的 ad-hoc 查询 |
| 问题 | 已知的问题模式 | 未知的、未预见的问题 |
| 哲学 | 基于假设 | 基于探索 |
| 工具 | Nagios、Zabbix | Prometheus + Grafana + Loki + Tempo |

```
监控思维：
  "我知道系统会在 CPU > 90% 时出问题，所以我监控 CPU"

可观测性思维：
  "我不知道系统会怎么出问题，所以我收集所有信号，
   出问题时可以探索性地分析"
```

## 4. 设计原则

```
可观测性设计原则

1. 默认输出（Observability by Design）
   ├── 每个服务启动时暴露 /metrics
   ├── 每个请求生成结构化日志
   ├── 每个入口传播 Trace Context
   └── 不是事后打补丁

2. 结构化数据
   ├── JSON 格式日志（可查询、可索引）
   ├── 标签化的 Metrics（高基数维度）
   ├── 标准化的 Trace（OpenTelemetry）
   └── 避免纯文本日志

3. 上下文传播
   ├── Request ID：贯穿单个请求
   ├── Trace ID：贯穿分布式链路
   ├── User ID：关联用户行为
   └── Session ID：关联会话

4. 采样策略
   ├── Head-based：请求入口决定是否采样
   ├── Tail-based：请求完成后决定是否采样（捕获异常）
   ├── Probabilistic：固定概率采样
   └── Adaptive：动态调整采样率

5. 关联设计
   ├── Metrics 中嵌入 TraceID 示例
   ├── Logs 中包含 TraceID 和 SpanID
   ├── Traces 链接到对应时间段的 Metrics
   └── Dashboard 支持从 Metrics 跳转到 Logs/Traces
```

```python
# 结构化日志 + 上下文传播示例
import structlog
import uuid

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

def get_logger(request_id=None, trace_id=None, user_id=None):
    return structlog.get_logger(
        request_id=request_id or str(uuid.uuid4()),
        trace_id=trace_id,
        user_id=user_id,
    )

# 使用
logger = get_logger(trace_id="trace-abc123", user_id="user-456")
logger.info("user_login", method="password", mfa=True, duration_ms=150)
# 输出：{"event": "user_login", "request_id": "...", "trace_id": "trace-abc123", 
#        "user_id": "user-456", "method": "password", "mfa": true, "duration_ms": 150}
```
