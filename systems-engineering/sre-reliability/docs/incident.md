# Incident Response Playbook

## 目标

掌握生产环境故障的响应流程：分级、响应、定位、修复、复盘。

## 场景

- 告警触发后应该怎么做？
- 故障定位的优先级是什么？
- 什么时候应该升级（Escalation）？
- 复盘怎么写才能有效改进？

## 故障分级

### 分级标准

| 级别 | 定义 | 响应时间 | 例子 |
|---|---|---|---|
| P0 | 核心服务完全不可用 | 5 分钟 | 支付服务挂了 |
| P1 | 核心服务降级 > 20% | 15 分钟 | 搜索不可用 |
| P2 | 非核心服务不可用 | 30 分钟 | 消息通知延迟 |
| P3 | 非核心服务降级 | 2 小时 | 后台报表慢 |

### 快速分级问题

```
1. 用户能正常使用服务吗？ -> 是：P2/P3，否：P0/P1
2. 影响多少用户？ -> 全量：P0/P1，部分：P2
3. 核心业务流程阻断？ -> 是：P0/P1
4. 数据是否正确？ -> 异常：P0
```

## 响应流程

### 阶段 0：Detection（发现）

```
告警来源：
  - Prometheus + AlertManager
  - CloudWatch
  - Grafana Dashboard
  - 用户反馈（JIRA/Slack）

触发后的第一步：
  - 确认告警是否真实（Ping 检查）
  - 快速评估影响范围
  - 立即通知值班工程师
```

### 阶段 1：Triage（分诊）

```
立即行动：
  1. 找到故障服务的 Owner
  2. 确认故障开始时间
  3. 确认影响范围（用户量、功能）
  4. 决定是否需要立即回滚/降级

通信：
  - 在 Slack/飞书/钉钉开 incident channel
  - 同步状态：#incident：我们正在处理 X 服务 Y 问题
```

### 阶段 2：Mitigation（止损）

```
止血优先于根因：
  - 回滚最近发布（最常见的故障原因）
    kubectl rollout undo deployment/<name>
  - 关闭流量开关（功能开关）
  - 限流/降级非核心功能
  - 切到备份/备用系统

优先级：
  1. 让用户先能用（止血）
  2. 再排查根因
```

### 阶段 3：Diagnosis（定位）

```
定位顺序：
  1. 服务层：日志、metrics、trace
  2. 基础设施层：网络、存储、计算
  3. 依赖服务：数据库、缓存、第三方 API

常用命令：
  kubectl get pods -n <ns>  # 看 Pod 状态
  kubectl logs <pod>       # 看日志
  kubectl describe <pod>    # 看事件
  kubectl top pod           # 看资源
  
  # 查看健康检查
  kubectl get hpa
  
  # 查看 events
  kubectl get events --sort-by=.lastTimestamp
```

### 阶段 4：Resolution（修复）

```
修复方式：
  1. 回滚（最安全，最快）
  2. 修复配置（ConfigMap/Secret）
  3. 重启 Pod（清理脏状态）
  4. 扩容（处理资源不足）
  5. 切换流量（DNS/负载均衡）

验证：
  - 监控指标恢复正常
  - 用户反馈停止
  - 健康检查通过
```

### 阶段 5：Communication（通信）

```
内部通信：
  - 每 15 分钟在 incident channel 同步状态
  - 明确当前状态（Investigating / Identified / Resolved）
  - 明确下一步行动

外部通信（客户-facing 服务）：
  - Status page 更新
  - 技术博客/公告（如有需要）
```

### 阶段 6：Postmortem（复盘）

```
复盘要求：
  - 5 个为什么（根因分析）
  - Timeline（时间线）
  - Impact（影响）
  - Action Items（改进项）

复盘模板：
  1. Summary（概述）
  2. Impact（影响：用户、功能、收入）
  3. Timeline（时间线：每一步的时间点）
  4. Root Cause（根因）
  5. What went well（做得好）
  6. What went wrong（做得差）
  7. Action Items（改进项：每条要有 owner 和 deadline）
```

## 常用止血工具

### 回滚

```bash
# Kubernetes Deployment 回滚
kubectl rollout undo deployment/<name> -n <namespace>
kubectl rollout history deployment/<name>
kubectl rollout undo deployment/<name> --to-revision=2

# 查看回滚原因
kubectl rollout history deployment/<name> --revision=2
```

### 限流/降级

```bash
# 开启功能开关
curl -X POST http://config-server/api/feature/<name>/off

# 限流
curl -X POST http://api-gateway/limit?max_rps=100

# 降级（关闭非核心功能）
curl -X POST http://config-server/api/feature/recommendation/off
```

### 扩容

```bash
# HPA 自动扩容
kubectl autoscale deployment <name> --cpu-percent=80 --min=2 --max=10

# 手动扩容（紧急）
kubectl scale deployment <name> --replicas=10
```

## L2：指标、自动化与边界

### MTTD / MTTR / MTBF

| 指标 | 定义 | 计算方式 | 目标 |
|---|---|---|---|
| MTTD (Mean Time To Detect) | 从故障发生到告警触发的时间 | `alert_time - failure_start_time` | < 5 min |
| MTTR (Mean Time To Recover) | 从告警触发到服务恢复的时间 | `resolved_time - alert_time` | P0 < 30 min |
| MTBF (Mean Time Between Failures) | 两次故障间隔 | `total_uptime / failure_count` | 越长越好 |

**注意**：MTTR 不包含根因修复，只到**服务恢复**（止血完成）。根因修复可能持续数小时，不应计入 MTTR。

### 自动化响应层级

```
Level 0: 人工响应
  告警 → 工程师手动处理

Level 1: 辅助决策
  告警 → 自动收集日志/metrics/trace → 推送到 Slack/飞书

Level 2: 自动止损
  告警 → 自动触发 runbook（如自动回滚、自动扩容、自动切流量）
  条件：该 runbook 过去 10 次执行成功率 > 95%，且影响范围可控

Level 3: 自愈
  异常检测 → 自动修复（如重启不健康 Pod、清理磁盘、杀掉僵尸进程）
```

### 边界陷阱

1. **"止血优先"不等于"不记录"**：
   紧急回滚时如果忘记保留现场（日志、heap dump、线程 dump），事后可能永远无法定位根因。建议在止血脚本中**自动归档**关键证据。

2. **复盘没有 Action Item = 白做**：
   每条改进项必须有 OWNER 和 DEADLINE，并在下次复盘时 review 完成率。

3. **Escalation 不是失败**：
   值班工程师在 10 分钟内未定位就应升级，延迟升级会扩大故障影响。

## L3：可运行实验

见 `impl/incident_lab/`：

```bash
cd systems-engineering/sre-reliability/impl/incident_lab
python3 timeline_generator.py
```

脚本随机生成一段故障时间线，练习计算 MTTD/MTTR 和制定 Action Items。适合团队轮值班前演练。

## 核心追问

1. **止血和根因的优先级？** 止血优先。P0/P1 故障时，先让用户能用，再排查根因
2. **什么时候应该升级（Escalate）？** 15 分钟内未定位、影响扩大、需要其他团队协助、需要业务决策
3. **回滚失败怎么办？** 优先切换流量到备用版本；检查镜像仓库；考虑通过配置或功能开关临时关闭问题功能
4. **复盘和指责的关系？** 复盘是找系统问题，不是找人过错。目的是改进系统，不是惩罚个人
5. **P0 故障的标准是什么？** 核心服务完全不可用，影响所有用户，需要立即响应

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| SLO worksheet | L2+L3 | done |
| incident response playbook | **L2+L3** | **done** |
| error budget policy | L1 | todo |
| capacity planning worksheet | L1 | todo |
| disaster recovery checklist | L1 | todo |