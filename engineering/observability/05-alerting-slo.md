# 告警与 SLO

## 1. SLO / SLI / SLA

```
可靠性术语

SLI（Service Level Indicator）
├── 可量化的可靠性指标
├── 示例：
│   ├── 可用性：成功请求数 / 总请求数
│   ├── 延迟：P99 响应时间 < 200ms
│   ├── 错误率：错误请求 < 0.1%
│   └── 吞吐量：> 1000 RPS
└── 好的 SLI：用户可感知、可度量、可比较

SLO（Service Level Objective）
├── SLI 的目标值
├── 示例：
│   ├── 可用性 SLO：99.9%（年停机 < 8.76 小时）
│   ├── 延迟 SLO：P99 < 200ms
│   └── 错误率 SLO：< 0.1%
└── SLO 是内部目标，不是对外承诺

SLA（Service Level Agreement）
├── 对用户的正式承诺
├── 包含未达标的赔偿条款
├── 通常比 SLO 更宽松
└── 示例：可用性 99.5%，未达标退款 10%

错误预算（Error Budget）
├── 定义：1 - SLO = 允许的错误率
├── 示例：SLO 99.9% → 错误预算 0.1%
├── 用途：
│   ├── 决定是否发布新版本（错误预算充足？）
│   ├── 优先级排序（可靠性 vs 新功能）
│   └── 团队考核指标
└── 消耗速度：消耗过快 → 暂停发布、投入可靠性工作
```

| SLO | 年停机时间 | 周停机时间 | 适用场景 |
|-----|-----------|-----------|----------|
| 99% | 3.65 天 | 1.68 小时 | 内部工具、批处理 |
| 99.9% | 8.76 小时 | 10.1 分钟 | 大多数在线服务 |
| 99.95% | 4.38 小时 | 5.04 分钟 | 电商平台 |
| 99.99% | 52.6 分钟 | 1.01 分钟 | 金融核心系统 |
| 99.999% | 5.26 分钟 | 6.05 秒 | 电信/支付网关 |

## 2. 告警设计

```
告警设计原则

症状-based（推荐）
├── 基于用户可见的指标
├── 示例：
│   ├── 错误率突增
│   ├── P99 延迟超过 SLO
│   └── 流量异常下降
└── 优点：直接反映用户体验

causes-based（辅助）
├── 基于系统内部指标
├── 示例：
│   ├── CPU 使用率 > 90%
│   ├── 磁盘空间 < 10%
│   └── 内存泄漏
└── 用途：根因分析、预测性告警

告警分级
├── P0（Page）：立即响应，业务中断
│   └── 示例：服务完全不可用、数据丢失
├── P1（Urgent）：1 小时内响应，功能受损
│   └── 示例：错误率 > 5%、核心功能降级
├── P2（High）：4 小时内响应，非核心功能受影响
│   └── 示例：次要功能不可用、性能下降
├── P3（Normal）：1 工作日响应，需要注意
│   └── 示例：磁盘使用率趋势、证书即将过期
└── P4（Low）：信息性，不需要立即行动
    └── 示例：版本发布通知、配置变更
```

```yaml
# Prometheus Alertmanager 规则
groups:
  - name: api_alerts
    rules:
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > 0.01
        for: 5m
        labels:
          severity: p1
          team: backend
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }}"
          runbook_url: "https://wiki.example.com/runbooks/high-error-rate"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          ) > 0.5
        for: 10m
        labels:
          severity: p2
          team: backend
        annotations:
          summary: "P99 latency high on {{ $labels.service }}"
```

## 3. 告警降噪

```
告警降噪策略
├── 去重：相同告警只发一次
├── 抑制：父告警触发时抑制子告警
│   └── 示例：NodeDown 抑制该节点上的所有 Pod 告警
├── 聚合：相似告警合并通知
│   └── 示例：10 个 Pod OOM → 一条聚合消息
├── 路由：按团队/级别路由到不同渠道
│   ├── P0 → PagerDuty + 电话
│   ├── P1 → Slack + SMS
│   └── P2 → Slack
├── 静默：维护窗口期间静默告警
└── 阈值优化：
    ├── 使用 for 持续时间避免瞬时峰值
    ├── 使用 rate/irate 避免计数器重置误报
    └── 考虑业务周期性（工作日 vs 周末）
```

```yaml
# Alertmanager 配置
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: default
  routes:
    - match:
        severity: p0
      receiver: pagerduty-critical
      continue: true
    - match:
        severity: p1
      receiver: slack-urgent
    - match:
        team: frontend
      receiver: slack-frontend

inhibit_rules:
  - source_match:
      severity: p0
    target_match:
      severity: p1
    equal: ['cluster', 'node']
```
