# Reliability

可靠性训练系统在失败、慢请求、依赖故障和流量波动下的表现。

## 稳定性构件

| 构件 | 目标 |
| --- | --- |
| Timeout | 避免无限等待 |
| Retry | 处理瞬时失败 |
| Circuit Breaker | 阻断持续故障 |
| Bulkhead | 隔离资源池 |
| Rate Limit | 控制入口流量 |
| Backpressure | 让上游感知下游压力 |
| Graceful Degradation | 保核心链路 |
| Graceful Shutdown | 安全停止服务 |

## 资产

| 资产 | 状态 | 目标 |
| --- | --- | --- |
| timeout budget design | todo | 端到端超时分配 |
| retry policy design | todo | 分类、退避、抖动 |
| circuit breaker implementation | todo | closed / open / half-open |
| graceful degradation plan | todo | 降级等级和开关 |
| failure mode table | todo | 依赖故障推演 |

## 追问

- 重试会不会放大故障？
- 超时应该设在哪里？
- 依赖挂了，核心链路如何保住？

