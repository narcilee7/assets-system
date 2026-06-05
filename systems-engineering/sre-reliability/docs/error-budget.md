# Error Budget Policy

## 目标

理解错误预算的概念、计算方法、以及如何使用错误预算来平衡可靠性和迭代速度。

## 场景

- 如何用错误预算决定发布节奏？
- 什么时候应该暂停发布？
- 错误预算消耗太快怎么办？
- SLO 不达标时的处理流程？

## 核心概念

### 错误预算定义

```
错误预算 = 在 SLO 周期内允许的"不达标"量

例子：
  - SLO: 99.9% (月)
  - 月总请求: 100,000,000
  - 允许失败: 100,000 (0.1%)
  
错误预算不是让你去消耗它，而是作为风险缓冲区。
```

## 计算方法

### 月度错误预算

```python
def error_budget_monthly(slo_percentage: float) -> dict:
    """月度错误预算计算"""
    # 每月分钟数（30天）
    total_minutes = 30 * 24 * 60  # 43200
    
    # 允许的停机时间（分钟）
    # slo = 99.9% -> 可用性 99.9% -> 不可用 0.1%
    downtime_minutes = (100 - slo_percentage) / 100 * total_minutes
    
    return {
        "slo": f"{slo_percentage}%",
        "total_minutes": total_minutes,
        "downtime_minutes": round(downtime_minutes, 2),
        "downtime_hours": round(downtime_minutes / 60, 2),
    }

# 示例
for slo in [99, 99.9, 99.99, 99.999]:
    result = error_budget_monthly(slo)
    print(f"{result['slo']}: {result['downtime_minutes']} 分钟 = {result['downtime_hours']} 小时")
```

输出：
```
99%: 432.0 分钟 = 7.2 小时
99.9%: 43.2 分钟 = 0.72 小时
99.99%: 4.32 分钟 = 0.072 小时
99.999%: 0.432 分钟 = 0.0072 小时
```

### Burn Rate（消耗速度）

```python
def burn_rate(slo_percentage: float, window_minutes: int) -> float:
    """
    Burn Rate = 实际错误率 / SLO 允许的错误率
    burn_rate = 1 表示正常消耗
    burn_rate > 1 表示加速消耗
    burn_rate < 1 表示节省
    """
    allowed_error_rate = (100 - slo_percentage) / 100
    # 假设实际错误率
    actual_error_rate = 0.002  # 0.2%
    
    # 在 window 内的 burn rate
    burn = actual_error_rate / allowed_error_rate
    
    return burn

# 例子：99.9% SLO，1 小时内消耗了 1% 错误
# burn_rate = 0.01 / 0.001 = 10x
# 意思是：正常速度的 10 倍在消耗
```

## 错误预算策略

### 发布节奏决策

```
错误预算充足（> 50% 剩余）：
  - 可以按正常节奏发布
  - 风险容忍度高

错误预算不足（< 30% 剩余）：
  - 放慢发布节奏
  - 避免大变更

错误预算耗尽（< 10% 剩余）：
  - 暂停所有非紧急发布
  - 专注可靠性
  - 立即开始根因分析
```

### 阶段门控

```yaml
# 发布门控：检查错误预算消耗
Gate: Error Budget Check
  if remaining_budget > 50%:
    allow_release()        # 正常发布
  elif remaining_budget > 30%:
    require_review()       # 需要 review
  elif remaining_budget > 10%:
    require_approval()     # 需要 manager 批准
  else:
    block_release()        # 阻止发布
```

## 错误预算监控

### Prometheus 告警

```yaml
groups:
- name: error-budget
  rules:
  # 快速燃烧告警：1h 燃烧了 10% 的错误预算
  - alert: ErrorBudgetFastBurn
    expr: |
      (
        sum(rate(http_requests_total{status=~"5.."}[1h]))
        / 
        sum(rate(http_requests_total[1h]))
      ) > 0.001
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Error budget burning fast: {{ $value }}x burn rate"

  # 慢速燃烧告警：6h 燃烧了 50% 的错误预算
  - alert: ErrorBudgetSlowBurn
    expr: |
      (
        sum(rate(http_requests_total{status=~"5.."}[6h]))
        / 
        sum(rate(http_requests_total[6h]))
      ) > 0.05
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Error budget consuming: {{ $value }}% over 6h"
```

### Dashboard 展示

```
Dashboard 面板：
  - 当前错误预算剩余（百分比）
  - 过去 7 天消耗趋势
  - Burn rate 趋势
  - SLO 达成率（7d / 30d）
```

## 常见场景

### 场景 1：新版本导致错误预算快速消耗

```
问题：新版本上线后，错误率从 0.05% 增加到 0.2%

分析：
  - SLO: 99.9% (允许 0.1% 错误)
  - 当前错误率 0.2% > 0.1%
  - Burn rate: 2x（是正常速度的 2 倍）

行动：
  1. 如果 burn rate > 5x：立即回滚
  2. 如果 burn rate > 2x：评估是否需要回滚
  3. 根因分析
  4. 修复后重新发布
```

### 场景 2：长期 SLO 不达标

```
问题：连续 3 个月 SLO 低于 99.9%

分析：
  - 根本原因可能是系统设计问题
  - 需要架构级别的改进

行动：
  1. 评估 SLO 目标是否合理（99.9% 是否过于严格？）
  2. 投资可靠性改进
  3. 短期可以放宽 SLO（但要通知用户）
  4. 长期必须解决根因
```

## 核心追问

1. **错误预算为什么不能全部消耗？** 错误预算是缓冲区，消耗完意味着 SLO 不达标；需要留 buffer 应对突发问题
2. **Burn Rate 怎么算？** Burn Rate = 实际错误率 / 允许错误率；>1 表示消耗加速
3. **什么时候应该回滚？** Burn Rate > 5x 时；错误预算剩余 < 10% 时；核心功能受影响时
4. **错误预算消耗快怎么处理？** 先止血（回滚），再根因分析，最后决定下一步
5. **SLO 达不到怎么办？** 先评估目标是否合理；短期可以放宽；长期需要架构改进

## L2：源码锚定与边界陷阱

### 源码锚定

| 实现/规范 | 关键源码/函数 | 说明 |
|---|---|---|
| Prometheus histogram_quantile | `promql/quantile.go` 中 `bucketQuantile` | 线性插值估算分位点；桶边界越宽误差越大，直接决定 SLI 准确性 |
| Prometheus recording rule | `rules/manager.go` 中 `eval()` | 预聚合降低查询复杂度；rule evaluation interval 必须小于告警窗口 |
| Alertmanager group_wait | `dispatch/dispatch.go` 中 `calcTimeout` | `group_wait` 过短导致告警风暴，过长延迟通知 |
| Google SRE Workbook | 第 2 章 Multi-window, Multi-burn-rate alerts | 快速燃烧（短窗口高倍率）+ 慢速燃烧（长窗口低倍率）的组合策略 |
| Kubernetes SLO 实现 | `slo-monitor` 中 latency SLI 按 verb/resource 拆分 | 不同 API 延迟要求不同，统一阈值会误报 |

### 边界陷阱

1. **错误预算 ≠ 允许故意出错**：预算是风险缓冲，用于衡量可靠性债务；故意消耗预算会侵蚀应对突发故障的能力
2. **滚动窗口 vs 日历窗口**：滚动窗口（rolling 30d）永远有历史包袱，日历窗口（calendar month）月初重置可能掩盖月末故障
3. **多 SLI 的预算冲突**：可用性预算和延迟预算独立计算时，一个故障可能同时消耗两份预算，导致过早冻结发布
4. ** burn rate 跳变**：短窗口（1h）burn rate 对尖峰敏感，长窗口（3d）burn rate 对累积敏感；只设单一窗口会漏报或误报
5. **错误预算为负**：如果当前周期已超标，剩余预算为负数；此时应冻结发布并启动可靠性专项，而不是等待自然恢复
6. **百分位 SLI 的隐藏损失**：P99 延迟达标不代表全部用户满意；尾部 1% 的请求可能全部来自某个大客户
7. **数据回填导致预算重算**：修改 recording rule 或修正历史数据后，已消耗的错误预算可能发生变化，影响发布决策

## L3：可运行实验

> 实验目录：`systems-engineering/sre-reliability/impl/error_budget_lab/`

### 实验 1：错误预算计算器

```bash
cd systems-engineering/sre-reliability/impl/error_budget_lab
python3 budget_calculator.py
```

模拟不同 SLO（99%、99.9%、99.99%）在月度、季度周期内的允许停机时间；输出分钟/小时/天。

### 实验 2：Burn Rate 模拟器

```bash
python3 burn_rate_simulator.py
```

模拟随机错误流量，计算 1h、6h、3d 窗口的 burn rate；根据 Google SRE 推荐的多窗口多燃烧率规则触发告警（fast-burn / slow-burn）。

### 实验 3：发布门控决策

```bash
python3 release_gate.py --slo 99.9 --budget-remaining 0.25
```

输入当前剩余预算比例，输出发布建议（allow / review / approval / block）。

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| SLO worksheet | L3 | done |
| incident response playbook | L3 | done |
| error budget policy | L3 | done |
| capacity planning worksheet | L1 | todo |
| disaster recovery checklist | L1 | todo |