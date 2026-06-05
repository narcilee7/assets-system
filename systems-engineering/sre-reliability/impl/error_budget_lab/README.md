# Error Budget Lab

## Files

| 文件 | 说明 |
|---|---|
| `budget_calculator.py` | 计算不同 SLO 在月度/季度内的允许停机时间 |
| `burn_rate_simulator.py` | 模拟请求流量，按多窗口多燃烧率策略触发告警 |
| `release_gate.py` | 根据剩余预算比例输出发布门控决策 |

## Quick Start

```bash
python3 budget_calculator.py
python3 burn_rate_simulator.py --requests 50000 --error-rate 0.002
python3 release_gate.py --slo 99.9 --budget-remaining 0.25
```
