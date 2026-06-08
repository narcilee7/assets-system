# 告警与 SLO

## 1. 告警策略

### 阈值告警

```yaml
# 示例：Prometheus Alertmanager 规则
- alert: HighErrorRate
  expr: |
    (
      sum(rate(frontend_errors_total[5m]))
      /
      sum(rate(frontend_page_views_total[5m]))
    ) > 0.01  # 错误率 > 1%
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate on {{ $labels.route }}"
    description: "Error rate is {{ $value | humanizePercentage }}"

- alert: SlowLCP
  expr: |
    histogram_quantile(0.95,
      rate(frontend_lcp_seconds_bucket[5m])
    ) > 2.5
  for: 10m
  labels:
    severity: warning
```

### 异常检测（动态阈值）

```javascript
// 基于历史数据的动态阈值
// 如果当前值偏离历史均值超过 3 个标准差，触发告警

function detectAnomaly(current, history) {
  const mean = average(history);
  const std = standardDeviation(history);
  const zScore = Math.abs(current - mean) / std;

  return {
    isAnomaly: zScore > 3,
    zScore,
    expected: mean,
    deviation: current - mean,
  };
}

// 使用：检测异常的错误率峰值
const hourlyErrorRates = [0.5, 0.4, 0.6, 0.5, 0.4, 0.5];  // 历史数据
const currentRate = 5.0;  # 当前错误率 5%
const result = detectAnomaly(currentRate, hourlyErrorRates);
// { isAnomaly: true, zScore: ~12, expected: 0.48, deviation: 4.52 }
```

## 2. SLI / SLO / SLA

```
SLI (Service Level Indicator) = 可量化的指标
  └─ 示例：LCP < 2.5s 的比例、错误率、API 可用性

SLO (Service Level Objective) = SLI 的目标值
  └─ 示例：99% 的 LCP < 2.5s、错误率 < 0.1%

SLA (Service Level Agreement) = 对用户的承诺（合同）
  └─ 示例：如果可用性 < 99.9%，赔偿用户
```

### 前端 SLO 示例

| SLI | SLO | 测量窗口 |
|-----|-----|----------|
| LCP < 2.5s | 90% | 7 天 |
| INP < 200ms | 85% | 7 天 |
| CLS < 0.1 | 95% | 7 天 |
| JS Error Rate | < 0.5% | 1 天 |
| API P95 Latency | < 1s | 1 天 |
| 页面可用性 | > 99.9% | 30 天 |

### 错误预算

```
错误预算 = 1 - SLO

如果 SLO = 99.9%（可用性）
错误预算 = 0.1% = 43.8 分钟/月

用法：
- 错误预算充足 → 可以发布新功能
- 错误预算耗尽 → 冻结发布，专注稳定性
- 错误预算透支 → 启动事故响应
```

## 3. On-Call 策略

```
告警分级：
├─ P0 (Critical) : 服务完全不可用，立即响应（5 分钟内）
├─ P1 (High)     : 核心功能受损，30 分钟内响应
├─ P2 (Medium)   : 部分用户受影响，4 小时内响应
└─ P3 (Low)      : 轻微问题，下一个工作日处理

告警降噪：
├─ 同一问题 5 分钟内只发一次
├─ 自动恢复后发送恢复通知
├─ 工作时间外 P2 以下不电话告警
└─ 每周 review 告警，消除无效告警
```

## 4. 告警模板

```markdown
## 告警：{{ alert.name }}

| 字段 | 值 |
|------|-----|
| 严重级别 | {{ alert.severity }} |
| 影响范围 | {{ alert.affected_users }} 用户 |
| 开始时间 | {{ alert.start_time }} |
| 持续时间 | {{ alert.duration }} |

### 快速诊断
- [错误列表]({{ sentry.url }})
- [性能大盘]({{ grafana.url }})
- [Trace 详情]({{ jaeger.url }})
- [最近发布]({{ release.url }})

### Runbook
1. 查看错误详情，确认影响范围
2. 检查最近发布是否相关
3. 如确认是发布引入，执行回滚
4. 更新状态页通知用户
```
