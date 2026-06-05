# SLO Worksheet

## 目标

掌握 SLO 的定义方法：错误预算计算、SLI 选择、以及如何将业务需求转换为 SLO。

## 场景

- 如何为服务定义合理的 SLO？
- 错误预算怎么用？
- SLO 告警怎么配置？
- SLO 和 SLA 的区别？

## 核心概念

### SLI / SLO / SLA

```
SLI（Service Level Indicator）：
  - 实际测量的指标，如请求成功率、延迟
  - "过去 5 分钟内，99% 的请求延迟 < 200ms"

SLO（Service Level Objective）：
  - 目标值，如 99.9%
  - "我们追求 99.9% 的请求延迟 < 200ms"

SLA（Service Level Agreement）：
  - 承诺给客户的合同，SLO 不达标时可能有赔偿
  - 通常比 SLO 宽松
```

### 常见 SLI 类型

| 类型 | SLI | 说明 |
|---|---|---|
| 可用性 | 请求成功率 | 2xx 响应 / 总请求 |
| 延迟 | P99 延迟 | Top 1% 最慢请求的延迟 |
| 吞吐量 | QPS | 每秒处理的请求数 |
| 质量 | 错误率 | 5xx / 总请求 |
| 正确性 | 数据完整性 | 读取数据与写入数据一致性 |

## SLO 定义流程

### 1. 确定用户旅程

```
用户旅程（User Journey）：
  1. 打开应用
  2. 搜索商品
  3. 加入购物车
  4. 下单支付

每一步都是用户真正关心的，任何一步失败都影响体验
```

### 2. 选择 SLI

```yaml
# 示例：电商搜索服务

用户关心：
  - 搜索结果返回
  - 结果相关性
  - 搜索延迟

SLI 定义：
  - SLI: 请求成功率 >= 99.5%
    - 指标: sum(rate(http_requests_total{service="search",code!~"5.."}[5m])) / sum(rate(http_requests_total{service="search"}[5m]))

  - SLI: P99 延迟 <= 500ms
    - 指标: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="search"}[5m])) <= 0.5
```

### 3. 设置 SLO 目标

```yaml
# 常见 SLO 目标
服务类型：
  - 核心服务（如支付）：99.99%（4 个 9）
  - 高流量服务（如搜索）：99.9%（3 个 9）
  - 后台服务（如批处理）：99%（2 个 9）

SLO = (成功请求 / 总请求) >= 99.9%
```

## 错误预算

### 什么是错误预算

```
月度 SLO 99.9%：
  - 月总时间：43200 分钟（30 天）
  - 允许停机时间：43.2 分钟

错误预算 = (1 - SLO) × 总时间
```

### 错误预算计算

```python
# 错误预算计算
def error_budget(slo: float, period_days: int) -> dict:
    total_minutes = period_days * 24 * 60
    allowed_downtime_minutes = (1 - slo) * total_minutes
    
    return {
        "total_minutes": total_minutes,
        "allowed_downtime_minutes": allowed_downtime_minutes,
        "allowed_downtime_hours": allowed_downtime_minutes / 60
    }

# 99.9% SLO，月度
print(error_budget(0.999, 30))
# {'total_minutes': 43200, 'allowed_downtime_minutes': 43.2, 'allowed_downtime_hours': 0.72}

# 99.99% SLO，月度
print(error_budget(0.9999, 30))
# {'total_minutes': 43200, 'allowed_downtime_minutes': 4.32, 'allowed_downtime_hours': 0.072}
```

### 错误预算的用途

```
1. 决定发布节奏
   - 错误预算消耗快：暂停发布，专注稳定性
   - 错误预算充足：可以更激进发布

2. 告警阈值
   - 消耗 > 10%/天：告警
   - 消耗 > 50%/周：严重告警

3. 回归标准
   - 新版本导致错误预算消耗 > 5%：回滚
```

## SLO 告警配置

### 多窗口告警

```yaml
# Prometheus alerting rules
groups:
- name: slo-alerts
  rules:
  # 快速告警：短期高错误率
  - alert: SLOSessionErrorRateHigh
    expr: |
      sum(rate(http_requests_total{service="api",code=~"5.."}[5m])) 
      / 
      sum(rate(http_requests_total{service="api"}[5m])) > 0.01
    for: 2m
    labels:
      severity: critical
      slo: api-availability
    annotations:
      summary: "API error rate > 1% (SLO: 99.9%)"
      runbook: "https://wiki.internal/runbooks/api-error-rate"

  # 慢速告警：累计错误预算消耗
  - alert: SLOErrorBudgetExhausted
    expr: |
      (
        sum(rate(http_requests_total{service="api",code=~"5.."}[1h])) 
        / 
        sum(rate(http_requests_total{service="api"}[1h]))
      ) > 0.001
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "API error budget consuming > 10% per hour"
```

### Burn Rate Alert

```yaml
# Burn Rate Alert（消耗速度告警）
# 1 小时窗口消耗了 10% 的错误预算 = 10x burn rate

- alert: SLIBurnRateHigh
  expr: |
    (
      sum(rate(http_requests_total{service="api",code=~"5.."}[1h]))
      / 
      sum(rate(http_requests_total{service="api"}[1h]))
    ) > 0.001  # 10x burn rate for 99.9% SLO
  for: 5m
  labels:
    severity: critical

# 快速燃烧告警（1h 燃烧 > 10% 错误预算）
- alert: SLOFastBurn
  expr: |
    (
      sum(rate(http_requests_total{service="api",code=~"5.."}[1h]))
      / 
      sum(rate(http_requests_total{service="api"}[1h]))
    ) > 0.01  # 100x burn rate
  for: 3m
  labels:
    severity: page
```

## SLO 对比 SLA

```
SLA（给客户）：
  - 99.9% 可用性
  - 赔偿条款：每降 0.1% 赔偿 $XXX

SLO（内部目标）：
  - 99.95% 可用性
  - 比 SLA 更严格，留出 buffer

实践：
  - SLO 达标但低于 SLA：内部改进
  - SLO 持续达标：考虑放松 SLO，释放资源
```

## 核心追问

1. **SLO 和 SLA 的区别？** SLO 是内部追求的目标，SLA 是对外承诺的合同；SLO 应该比 SLA 更严格
2. **错误预算怎么用？** 用于决定发布节奏和告警阈值；错误预算消耗快时暂停发布，充足时可以激进
3. **Burn Rate Alert 是什么？** 衡量错误预算消耗速度；1 小时内消耗了 10% 的月度错误预算 = 10x burn rate
4. **如何选择 SLI？** 基于用户旅程，选择用户真正关心的指标；通常是请求成功率、延迟、吞吐量
5. **P99 延迟和 P50 延迟的区别？** P50 是中位数，50% 请求低于此值；P99 是 99 分位，1% 最慢请求的延迟

## 状态

| 资产 | 状态 |
|---|---|
| SLO worksheet | done |
| incident response playbook | todo |
| error budget policy | todo |
| capacity planning worksheet | todo |
| disaster recovery checklist | todo |