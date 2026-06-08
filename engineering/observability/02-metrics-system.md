# 指标系统

## 1. Prometheus 核心概念

```
Prometheus 架构

┌─────────┐     ┌──────────────┐     ┌──────────┐
│ Target  │────▶│  Prometheus  │────▶│ Grafana  │
│ (App)   │pull │   Server     │query│(Dashboard)│
└─────────┘     └──────────────┘     └──────────┘
       │               │
       │               ▼
       │        ┌──────────────┐
       │        │   Alertmanager│
       │        │   (告警路由)   │
       │        └──────────────┘
       │
       ▼
┌──────────────┐
│  Pushgateway │  ← 短生命周期任务
│  (可选)       │
└──────────────┘

数据模型：
├── 时间序列：metric_name{label1="value1", label2="value2"}
├── 样本：(timestamp, value)
├── 指标名称：字母、数字、下划线、冒号
└── 标签：键值对，用于多维度区分
```

```
指标类型（Prometheus）

Counter（计数器）
├── 单调递增（可重置）
├── 用于：请求总数、错误总数、任务完成数
└── 查询：rate(http_requests_total[5m])

Gauge（仪表盘）
├── 可增可减
├── 用于：温度、内存使用、队列长度、并发数
└── 查询：memory_usage_bytes

Histogram（直方图）
├── 采样值分布到桶中
├── 自动计算：_bucket、_sum、_count
├── 用于：请求延迟、响应大小
└── 查询：histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

Summary（摘要）
├── 客户端计算分位数
├── 配置：分位数 + 误差范围 + 衰减时间
├── 用于：需要精确分位数且客户端计算
└── 注意：服务端不可聚合
```

```python
# Python Prometheus Client
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time
import random

# 定义指标
http_requests = Counter('http_requests_total', 'Total HTTP requests', ['method', 'status'])
request_duration = Histogram('http_request_duration_seconds', 'Request duration', ['method'])
active_connections = Gauge('active_connections', 'Number of active connections')

# 启动 metrics endpoint
start_http_server(8000)

# 使用
@request_duration.time()
def handle_request(method):
    active_connections.inc()
    try:
        time.sleep(random.random() * 0.1)
        status = '200' if random.random() > 0.1 else '500'
        http_requests.labels(method=method, status=status).inc()
        return status
    finally:
        active_connections.dec()
```

## 2. 指标设计方法

```
RED 方法（面向请求的服务）
├── Rate（速率）：每秒请求数
├── Errors（错误）：每秒错误请求数
└── Duration（持续时间）：请求处理时间

USE 方法（面向资源的服务）
├── Utilization（利用率）：资源使用百分比
├── Saturation（饱和度）：排队工作量 / 过载程度
└── Errors（错误）：错误计数

四个黄金信号（Google SRE）
├── Latency（延迟）：服务处理请求的时间
├── Traffic（流量）：请求量 / QPS
├── Errors（错误）：错误率
└── Saturation（饱和度）：服务容量使用率

指标命名规范
├── 使用 snake_case
├── 包含单位：_seconds、_bytes、_total
├── 后缀区分类型：
│   ├── _total：Counter
│   ├── _bucket：Histogram bucket
│   ├── _sum：Histogram/Summary 总和
│   ├── _count：Histogram/Summary 计数
│   └── _info：信息性 Gauge
└── 避免高基数标签：user_id、email、IP（除非聚合后）
```

```python
# RED 指标示例
from prometheus_client import Counter, Histogram

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['service', 'method', 'route', 'status_code']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['service', 'method', 'route', 'status_code'],
    buckets=[.005, .01, .025, .05, .075, .1, .25, .5, .75, 1.0, 2.5, 5.0, 7.5, 10.0]
)

# Middleware
class MetricsMiddleware:
    def process_request(self, request):
        request.start_time = time.time()

    def process_response(self, request, response):
        duration = time.time() - request.start_time
        labels = {
            'service': 'payment-service',
            'method': request.method,
            'route': request.path,
            'status_code': str(response.status_code),
        }
        http_requests_total.labels(**labels).inc()
        http_request_duration_seconds.labels(**labels).observe(duration)
        return response
```

## 3. Grafana 可视化

```
Dashboard 设计原则
├── 从上到下：概览 → 细节 → 原始数据
├── 从左到右：关键指标 → 辅助指标
├── 使用适当图表：
│   ├── 时间序列：折线图（趋势）
│   ├── 分布：热力图、直方图
│   ├── 当前值：Stat、Gauge
│   ├── 比例：饼图、条形图
│   └── 地理：地图
├── 颜色编码：
│   ├── 绿色：正常
│   ├── 黄色：警告
│   └── 红色：严重
└── 添加链接：从 Dashboard 跳转到 Traces/Logs

Dashboard 层级
├── L1 - 服务概览（SLO 仪表板）
│   ├── 可用性
│   ├── 错误率
│   ├── P99 延迟
│   └── 流量
├── L2 - 服务详情（组件级别）
│   ├── 各 API 延迟
│   ├── 数据库连接池
│   ├── 缓存命中率
│   └── 队列深度
└── L3 - 基础设施（机器级别）
    ├── CPU / 内存
    ├── 磁盘 I/O
    ├── 网络
    └── 进程
```
