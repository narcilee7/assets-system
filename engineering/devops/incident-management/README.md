# Incident Management

## 目标

训练线上故障响应：On-Call、告警处理、Postmortem、MTTR 优化。

## 核心概念

| 概念 | 解释 |
| --- | --- |
| On-Call | 值班机制 |
| Alert | 告警触发 |
| Incident | 故障事件 |
| Severity | 严重等级 |
| MTTR | Mean Time To Recovery |
| Postmortem | 故障复盘 |

## 严重等级定义

| 等级 | 说明 | 响应时间 | 示例 |
| --- | --- | --- | --- |
| SEV1 | 全面故障 | 5 分钟 | 服务不可用、数据丢失 |
| SEV2 | 部分故障 | 15 分钟 | 部分功能不可用 |
| SEV3 | 低优先级 | 1 小时 | 非核心功能异常 |
| SEV4 | 通知 | 工作时间 | 日志异常 |

## On-Call 值班

### 值班轮次设计

```yaml
# PagerDuty 或类似工具配置
on_call:
  primary:
    schedule: weekly
    escalation_timeout: 15m
  secondary:
    schedule: weekly
    escalation_timeout: 30m
  manager:
    schedule: weekly
    escalation_timeout: 1h
```

### 值班职责

1. **响应时间**：SEV1 < 5 分钟，SEV2 < 15 分钟
2. **告警处理**：先止血，再排查
3. **升级机制**：超出能力范围立即升级
4. **交接流程**：值班结束时交接待处理事项

## 故障响应流程

```
告警触发
    │
    ▼
确认告警（是否真实？）
    │
    ├─── 是 ────▶ 创建 Incident
    │                    │
    │                    ▼
    │              评估 Severity
    │                    │
    │         ┌─────────┼─────────┐
    │         ▼         ▼         ▼
    │       SEV1      SEV2      SEV3
    │         │         │         │
    │         ▼         ▼         ▼
    │    立即响应   15min处理   1h处理
    │         │         │         │
    │         └─────────┼─────────┘
    │                   ▼
    │            故障修复
    │                   │
    │                   ▼
    │            通知相关方
    │                   │
    │                   ▼
    │            Postmortem
    │
    └─── 否 ────▶ 关闭告警（标记误报）
```

## Runbook 模板

```markdown
# [服务名] 故障处理手册

## 快速联系
- On-Call:
- Team Lead:
- SRE:

## 常见故障处理

### 1. 服务无响应
**症状**: HTTP 5xx / 超时

**排查步骤**:
1. 检查 Pod 状态
   ```bash
   kubectl get pods -n production
   kubectl describe pod <pod-name> -n production
   kubectl logs <pod-name> -n production
   ```

2. 检查资源使用
   ```bash
   kubectl top pods -n production
   ```

3. 检查 HPA 是否触发
   ```bash
   kubectl get hpa -n production
   ```

**止血方案**:
- 重启 Pod: `kubectl rollout restart deployment/<name> -n production`
- 扩容: `kubectl scale deployment <name> --replicas=5 -n production`

### 2. 数据库连接超时
**症状**: 数据库连接错误

**排查步骤**:
1. 检查数据库 Pod
2. 检查连接池使用
3. 检查慢查询

**止血方案**:
- 重启数据库 Pod
- 临时增加连接数

### 3. 内存溢出 (OOM)
**症状**: Pod 处于 OOMKilled 状态

**排查步骤**:
1. 查看 Pod 事件
   ```bash
   kubectl describe pod <pod> -n production | grep -A5 "Last State"
   ```

2. 查看内存使用趋势

**止血方案**:
- 增加 memory limit
- 检查内存泄漏

## 止血命令速查

```bash
# 重启服务
kubectl rollout restart deployment/<name> -n production

# 扩容
kubectl scale deployment <name> --replicas=5 -n production

# 查看日志
kubectl logs -f deployment/<name> -n production

# 端口转发
kubectl port-forward svc/<name> 8080:80 -n production

# 进入容器
kubectl exec -it <pod> -n production -- sh
```
```

## Postmortem 模板

```markdown
# Incident Postmortem: [事故名称]

## 基本信息
- **日期**: YYYY-MM-DD
- **持续时间**: X 小时 Y 分钟
- **严重等级**: SEV[X]
- **影响范围**: [具体描述]
- **On-Call**: [姓名]
- **参与人员**: [列表]

## 时间线
| 时间 | 事件 |
| --- | --- |
| HH:MM | 告警触发 |
| HH:MM | On-Call 响应 |
| HH:MM | 确认为真实告警 |
| HH:MM | 开始排查 |
| HH:MM | 发现根因 |
| HH:MM | 执行修复 |
| HH:MM | 服务恢复 |
| HH:MM | 通知相关方 |

## 根因分析
[详细描述发生了什么，为什么发生]

### 根因
[一句话描述]

### 贡献因素
- [因素 1]
- [因素 2]

## 修复方案
| 修复项 | 负责人 | 完成日期 |
| --- | --- | --- |
| [修复内容] | [姓名] | [日期] |

## 复盘问题

### 问：告警响应是否及时？
答：...

### 问：沟通是否顺畅？
答：...

### 问：工具有效吗？
答：...

### 问：下次如何改进？
答：...

## 行动项
- [ ] [Action] - [Owner] - [Due Date]
```

## MTTR 优化

### 常见 MTTR 目标

| 严重等级 | 目标 MTTR |
| --- | --- |
| SEV1 | < 30 分钟 |
| SEV2 | < 2 小时 |
| SEV3 | < 8 小时 |

### 优化方向

1. **监控告警**：提前发现问题
2. **Runbook**：快速止血
3. **自动化**：减少人工操作
4. **可视化**：快速定位问题

## 面试追问

- On-Call 压力大怎么办？
  （答：合理轮换、值班补贴、事后复盘减少重复问题）
- 如何减少告警疲劳？
  （答：分级告警、抑制重复告警、SLO 阈值）
- Postmortem 的目的是什么？
  （答：学习而非追责、持续改进）

## 相关模式

- `monitoring-observability/`：告警来源
- `deployment-strategies/`：快速回滚