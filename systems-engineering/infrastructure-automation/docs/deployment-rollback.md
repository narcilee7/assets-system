# Deployment Rollback Playbook

## 目标

建立生产环境部署和回滚的系统化手册，覆盖蓝绿部署、金丝雀发布、滚动更新和紧急回滚，确保任何发布都能在可控时间内恢复。

## 场景

- 发布后发现 bug，30 秒内怎么回滚？
- 数据库 schema 变更后还能回滚代码吗？
- 金丝雀发布怎么判断继续还是回滚？
- 滚动更新卡住了怎么办？
- 回滚时数据一致性怎么保证？

## 部署策略对比

| 策略 | 描述 | 回滚速度 | 资源消耗 | 风险 | 适用 |
|---|---|---|---|---|---|
| 滚动更新（Rolling） | 逐个替换旧实例 | 慢（需重新部署旧版本） | 低 | 中 | 无状态服务，通用 |
| 蓝绿部署（Blue/Green） | 两套环境切换 | 极快（切流量） | 高（2x 资源） | 低 | 关键服务，资源充足 |
| 金丝雀（Canary） | 小流量验证后渐进 | 快（切流量或扩缩） | 中 | 低 | 核心服务，频繁发布 |
| 影子流量（Shadow） | 复制流量到新版，不响应 | N/A（不对外） | 高 | 无 | 核心重构，压力测试 |

## 滚动更新（Rolling Update）

### K8s 实现

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # 最多多 25% Pod（即 12 个）
      maxUnavailable: 25%  # 最少可用 75%（即 7 个）
  template:
    spec:
      containers:
        - name: app
          image: my-app:v2.0
          readinessProbe:    # 必须配置！
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
```

```
更新过程：
  1. 创建 3 个新 Pod（v2.0）
  2. 等待 readinessProbe 通过
  3. 删除 3 个旧 Pod（v1.0）
  4. 重复直到全部替换

问题：
  - 回滚慢：需要重新拉镜像、启动旧版本
  - 状态混合：同时存在新旧版本，需保证兼容
  - 卡住风险：新 Pod 起不来，无限循环
```

### 回滚

```bash
# K8s 回滚到上一个版本
kubectl rollout undo deployment/my-app

# 回滚到指定版本
kubectl rollout undo deployment/my-app --to-revision=3

# 查看历史
kubectl rollout history deployment/my-app
```

## 蓝绿部署（Blue/Green）

### 架构

```
        ┌─────────────┐
   ────►│  Load Balancer│
        └──────┬──────┘
               │
        ┌──────┴──────┐
        ▼             ▼
    ┌─────────┐   ┌─────────┐
    │  Blue   │   │  Green  │
    │ (v1.0)  │   │ (v2.0)  │
    │ Active  │   │ Standby │
    └─────────┘   └─────────┘

部署流程：
  1. Green 部署 v2.0
  2. 内部验证（smoke test）
  3. 切流量：LB → Green
  4. Blue 保持一段时间（快速回滚备用）
  5. 验证稳定后，释放 Blue

回滚：
  - 切流量回 Blue（秒级）
  - Green 保持备用
```

### K8s + Service 实现

```yaml
# Deployment Blue（v1.0）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app-blue
spec:
  replicas: 10
  selector:
    matchLabels:
      app: my-app
      version: blue
  template:
    metadata:
      labels:
        app: my-app
        version: blue
    spec:
      containers:
        - name: app
          image: my-app:v1.0

# Deployment Green（v2.0）
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app-green
spec:
  replicas: 10
  selector:
    matchLabels:
      app: my-app
      version: green
  template:
    metadata:
      labels:
        app: my-app
        version: green
    spec:
      containers:
        - name: app
          image: my-app:v2.0

# Service 切流量
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
    version: green  # 切到 green
  ports:
    - port: 80
      targetPort: 8080
```

## 金丝雀发布（Canary）

### 渐进式流量切换

```
流量比例：
  0%   → 5%  → 25%  → 50%  → 100%
        
每阶段检查：
  - 错误率 < 阈值
  - P99 延迟 < 阈值
  - 业务指标正常（订单量、转化率）
  
异常 → 自动回滚到 0%
正常 → 继续下一阶梯
```

### 实现方式

```yaml
# Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: my-app
spec:
  hosts:
    - my-app
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: my-app
            subset: v2
          weight: 100
    - route:
        - destination:
            host: my-app
            subset: v1
          weight: 95
        - destination:
            host: my-app
            subset: v2
          weight: 5
```

```yaml
# Argo Rollouts
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: {duration: 10m}
        - setWeight: 25
        - pause: {duration: 10m}
        - setWeight: 50
        - pause: {duration: 10m}
        - setWeight: 100
      analysis:
        templates:
          - templateName: error-rate
        args:
          - name: service-name
            value: my-app
```

### 自动判断指标

| 指标 | 检查内容 | 失败阈值 |
|---|---|---|
| HTTP 5xx 率 | 服务端错误比例 | > 0.1% |
| P99 延迟 | 尾部延迟 | > 基线 2 倍 |
| CPU 使用率 | 资源消耗异常 | > 80% |
| 内存使用 | OOM 风险 | > 85% |
| 业务指标 | 订单/转化率 | < 基线 95% |
| 日志错误 | ERROR 级别日志激增 | > 基线 3 倍 |

## 数据库变更与回滚

### 向后兼容的 Schema 变更

```
发布流程（避免代码和 schema 锁定）：

Step 1: 加列/加表（不影响旧代码）
  ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
  → 旧代码忽略新列，继续运行

Step 2: 发布新代码（读写新列）
  → 新代码读写 email_verified

Step 3: 回填数据（如果需要）
  UPDATE users SET email_verified = TRUE WHERE ...;

Step 4: 后续清理（可选）
  ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
  DROP COLUMN old_column;

回滚安全：
  - 回滚代码时，新列只是不被读写
  - 不会导致数据丢失或服务中断
```

### 不可回滚的变更

```
危险操作：
  - DROP COLUMN
  - DELETE 大量数据（无 WHERE 备份）
  - RENAME TABLE/COLUMN
  - 修改列类型（可能截断数据）

处理：
  1. 发布前备份（mysqldump、快照）
  2. 蓝绿数据库（影子库验证）
  3. 分阶段执行，每个阶段可独立回滚
  4. 低峰期操作，值班人员在岗
```

## 紧急回滚 SOP

### 决策树

```
发现异常
   │
   ├── 自动检测（监控告警）
   │      │
   │      ├── 金丝雀自动回滚？ ──► 是 ──► 自动执行
   │      └── 否 ──► 人工判断
   │
   └── 人工发现（客服反馈、日志）
          │
          ▼
    判断影响范围
          │
    ┌─────┴─────┐
    ▼           ▼
  影响小      影响大
    │           │
    ▼           ▼
  快速修复    立即回滚
  （hotfix）  （代码回滚）
    │           │
    ▼           ▼
  验证修复    验证恢复
```

### 回滚检查清单

```
□ 确认回滚范围（代码、配置、数据）
□ 通知相关团队（值班、业务、客服）
□ 停止当前发布流程
□ 执行回滚（代码、配置、数据库）
□ 验证服务恢复（健康检查、核心业务）
□ 监控 30 分钟确认稳定
□ 记录回滚原因和过程
□ 安排复盘（Post-mortem）
```

### 回滚自动化

```
理想状态：
  监控异常 → 自动判断 → 自动回滚 → 自动验证 → 通知人工

实现：
  - Argo Rollouts 自动回滚（analysis 失败）
  - K8s readinessProbe 失败自动停止滚动更新
  - 自定义 Controller：监听 Prometheus 指标，触发 rollback

人工兜底：
  - 自动回滚有上限（如只自动回滚金丝雀阶段）
  - 生产全量发布需人工确认回滚
```

## L2：K8s Deployment Controller 源码与回滚机制

### Deployment Controller 协调循环

```go
// kubernetes/pkg/controller/deployment/deployment_controller.go:syncDeployment
func (dc *DeploymentController) syncDeployment(ctx context.Context, key string) error {
    // 1. 获取 Deployment 对象
    d, err := dc.dLister.Deployments(namespace).Get(name)
    
    // 2. 获取关联的 ReplicaSets
    rsList, err := dc.getReplicaSetsForDeployment(d)
    
    // 3. 获取关联的 Pods
    podList, err := dc.getPodMapForDeployment(d, rsList)
    
    // 4. 核心：计算 scale 策略
    //    - 如果是滚动更新：根据 maxSurge/maxUnavailable 计算新/旧 RS 的副本数
    //    - 如果是回滚：将旧的 RS 的 revision 提升为当前，缩容新的 RS
    
    // 5. 执行 scale
    dc.scale(ctx, deployment, newRS, oldRSs)
    
    // 6. 清理过旧的 ReplicaSets（保留 revisionHistoryLimit 个，默认 10）
    dc.cleanupDeployment(oldRSs, deployment)
}
```

### 回滚的源码级行为

```go
// kubernetes/pkg/controller/deployment/rollback.go
func (dc *DeploymentController) rollback(d *apps.Deployment, rsList []*apps.ReplicaSet) error {
    // 回滚逻辑：
    // 1. 找到目标 revision 的 ReplicaSet（从 annotation 中解析 revision）
    // 2. 将该 RS 的 PodTemplateSpec 复制到 Deployment.Spec.Template
    // 3. 更新 Deployment → 触发正常的协调循环
    // 4. 新的协调循环会：缩容当前 RS，扩容旧的 RS
}
```

**关键洞察**：`kubectl rollout undo` 不是直接切换 RS，而是**修改 Deployment 的 Template**，让控制器重新协调。这意味着：
- 回滚速度受 `minReadySeconds` 和 `readinessProbe` 影响
- 如果旧镜像已被清理（imagePullPolicy: Always + registry 清理），回滚会失败

### 数字锚定：各部署策略的 RTO/RPO

| 策略 | RTO（恢复时间目标） | RPO（数据丢失目标） | 实际观测 |
|---|---|---|---|
| Rolling Update | 1-5 分钟（重新拉镜像） | 0（无状态） | 受 image pull + readiness 影响 |
| Blue/Green | ~5-30 秒（切流量） | 0 | 依赖 LB/Service 切换速度 |
| Canary | ~10-60 秒（切流量或扩缩） | 0 | 依赖监控判断 + 自动回滚 |
| 数据库 schema 变更 | 分钟级到小时级 | 可能 > 0 | 不可逆变更需要数据恢复 |

**RTO 差异的根本原因**：
- Rolling Update 需要重新创建 Pod（拉镜像 + 启动 + readiness），RTO 不可控。
- Blue/Green 和 Canary 只需要切换流量（修改 Service selector 或 VirtualService weight），RTO 极短。

### 边界陷阱

1. **回滚时旧镜像已被清理**：如果容器 registry 的镜像保留策略是 30 天，而上次发布是 60 天前，回滚会 ImagePullBackOff。建议：关键版本镜像永久保留，或使用 immutable tag。
2. **ConfigMap/Secret 不回滚**：`kubectl rollout undo` 只回滚 PodTemplateSpec（镜像、命令、资源限制），**不回滚 ConfigMap 和 Secret**。如果 bug 是由配置变更引起的，回滚 Deployment 无效。
3. **HPA 与手动缩容冲突**：回滚后如果 HPA 正在扩容，可能导致新旧版本同时存在更长时间。

## 核心追问

1. **蓝绿部署的资源成本怎么接受？** 只在关键服务使用，接受 2x 资源换取秒级回滚；或缩容 Blue 到最小保留（如 1 个实例），牺牲部分回滚速度换成本
2. **金丝雀的 5% 流量怎么选用户？** 随机（最简单）、按用户 ID 哈希（保证同一用户始终同一版本）、按地域（先灰度小区域）、按设备类型（先 iOS 后 Android）；避免按"VIP 用户"灰度（问题影响大）
3. **回滚时数据库连接池会抖动吗？** 会。大量实例同时重启 → 同时创建连接 → 数据库压力 spike；缓解：连接池预热、渐进式回滚、使用连接池代理（PgBouncer）
4. **K8s rollout undo 会触发 PreStop Hook 吗？** 会。Pod 终止时会执行 PreStop Hook（如优雅关闭连接），然后 SIGTERM，最后 SIGKILL；回滚也需要优雅终止
5. **发布和回滚谁应该有权限？** 发布权限可下放给团队；回滚权限应更广泛（值班、SRE、甚至自动化系统），紧急时刻不卡审批；但事后必须审计

## 状态

| 资产 | 深度 | 状态 |
|---|---|---|
| Terraform blueprint | L1 | done |
| GitOps workflow | L2 | done |
| config and secret layering | L1 | done |
| deployment rollback playbook | **L2** | **done** |
| policy as code notes | L1 | todo |
