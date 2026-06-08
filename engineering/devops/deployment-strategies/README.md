# Deployment Strategies

## 目标

训练生产级部署策略：滚动更新、蓝绿部署、金丝雀、A/B 测试。

## 策略对比

| 策略 | 停机时间 | 回滚速度 | 成本 | 风险 |
| --- | --- | --- | --- | --- |
| 滚动更新 | 0 | 分钟级 | 低 | 逐渐暴露问题 |
| 蓝绿部署 | 0 | 秒级 | 双倍资源 | 流量切换瞬间 |
| 金丝雀 | 0 | 分钟级 | 略高 | 小流量验证 |
| A/B 测试 | 0 | 分钟级 | 略高 | 可测量收益 |

## 滚动更新（Rolling Update）

K8s 默认策略，逐步替换 Pod。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # 最多超出几个 Pod
      maxUnavailable: 25%  # 最多不可用几个 Pod
```

### 流程

1. 启动 1 个新 Pod（maxSurge）
2. 等待新 Pod 就绪
3. 终止 1 个旧 Pod（maxUnavailable）
4. 重复直到全部更新

### 优点
- 零停机
- 资源占用少
- 自动回滚

### 缺点
- 新旧版本共存时间长
- 无法精确控制流量
- 回滚需要重新滚动

## 蓝绿部署（Blue-Green）

两套完整环境，切换流量。

```yaml
# Blue Environment (当前生产)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      slot: blue
  template:
    metadata:
      labels:
        app: myapp
        slot: blue
    spec:
      containers:
        - name: myapp
          image: myapp:v1.0.0

---
# Service 指向 Blue
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
    slot: blue  # 切换这里
  ports:
    - port: 80
      targetPort: 8080
```

```yaml
# Green Environment (新版本)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      slot: green
  template:
    metadata:
      labels:
        app: myapp
        slot: green
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
```

### 切换流程

```bash
# 1. 部署 Green 环境
kubectl apply -f myapp-green.yaml

# 2. 验证 Green 环境
kubectl rollout status deployment/myapp-green

# 3. 切换流量（修改 Service selector）
kubectl patch service myapp -p '{"spec":{"selector":{"slot":"green"}}}'

# 4. 观察
kubectl logs -l app=myapp,slot=green

# 5. 回滚（如需）
kubectl patch service myapp -p '{"spec":{"selector":{"slot":"blue"}}}'
```

### 优点
- 秒级切换
- 轻松回滚
- 易于验证

### 缺点
- 双倍资源成本
- 数据库兼容性问题
- 切换有风险

## 金丝雀部署（Canary）

先部署少量实例，验证后逐步全量。

### 方式一：Replica 差异

```yaml
# Stable (v1)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 10
  selector:
    matchLabels:
      app: myapp
      track: stable
  template:
    metadata:
      labels:
        app: myapp
        track: stable
    spec:
      containers:
        - name: myapp
          image: myapp:v1.0.0

---
# Canary (v2) - 1 个 Pod
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1  # 10% 流量
  selector:
    matchLabels:
      app: myapp
      track: canary
  template:
    metadata:
      labels:
        app: myapp
        track: canary
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0

---
# Service 选择所有
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp  # 不区分 track
  ports:
    - port: 80
```

### 方式二：Ingress 权重分流

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    # 10% 流量到 canary
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  ingressClassName: nginx
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            backend:
              service:
                name: myapp-canary
                port:
                  number: 80
```

### 渐进式切换

```bash
# 阶段 1: 10%
kubectl scale deployment myapp-canary --replicas=1

# 观察 metrics...

# 阶段 2: 50%
kubectl scale deployment myapp-canary --replicas=5

# 阶段 3: 100%
kubectl scale deployment myapp-canary --replicas=10
kubectl scale deployment myapp-stable --replicas=0

# 或使用 Argo Rollouts
```

### Argo Rollouts（推荐）

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: {}  # 手动暂停
        - setWeight: 50
        - pause: {duration: 5m}
        - setWeight: 100
      canaryMetadata:
        labels:
          track: canary
      stableMetadata:
        labels:
          track: stable
      trafficRouting:
        nginx:
          stableIngress: myapp-stable
      analysis:
        templates:
          - templateName: success-rate
        args:
          - name: service-name
            value: myapp-canary
```

## A/B 测试

基于用户特征分流。

### Header 分流

```yaml
nginx.ingress.kubernetes.io/configuration-snippet: |
  if ($http_x_user_group == "premium") {
    set $canary_backend "myapp-premium";
  }
```

### Cookie 分流

```yaml
annotations:
  nginx.ingress.kubernetes.io/canary-by-cookie: "user_segment"
  # canary: always（总是走 canary）
  # canary: never（从不走 canary）
  # canary: 30%（30% 流量走 canary）
```

### 用户群组分流

```yaml
# 基于 query 参数
nginx.ingress.kubernetes.io/canary-by-header-value: "X-User-Type"
nginx.ingress.kubernetes.io/canary-by-header: "X-User-Type"
```

## 数据库迁移策略

部署中最大的风险是数据库变更。

### 扩展性模式（Expand-Contract）

```
1. Expand: 添加新字段（v1 + 新列可空）
2. Migrate: 部署新版本代码（双写）
3. Contract: 删除旧字段（v2）
```

```sql
-- Step 1: Expand（添加新字段）
ALTER TABLE users ADD COLUMN email_v2 VARCHAR(255);

-- Step 2: Migrate（双写期间）
-- 应用层同时写入 email 和 email_v2
-- 迁移数据 email -> email_v2

-- Step 3: Contract（确认后删除旧字段）
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users RENAME COLUMN email_v2 TO email;
```

### 蓝绿数据库

```bash
# 1. 创建绿色数据库副本
pg_basebackup -h blue-db -D /green-db

# 2. 升级绿色数据库
psql -h green-db -c "ALTER TABLE..."

# 3. 切换连接
kubectl patch configmap db-config -p '{"data":{"host":"green-db"}}'
```

## 回滚策略

```bash
# K8s Deployment 回滚
kubectl rollout undo deployment/myapp
kubectl rollout undo deployment/myapp --to-revision=2

# Argo Rollouts 回滚
kubectl argo rollouts abort myapp
kubectl argo rollouts undo myapp

# 快速回滚脚本
#!/bin/bash
kubectl rollout undo deployment/$1 --namespace=$2
kubectl rollout status deployment/$1 --namespace=$2
```

## 面试追问

- 如何选择部署策略？
  （答：新功能小流量验证用 canary；大版本升级用 blue-green；常规滚动更新用 rolling update）
- 蓝绿部署的数据库问题？
  （答：避免数据库 schema 破坏性变更，使用 expand-contract 模式）
- 如何监控金丝雀的效果？
  （答：对比新旧版本的 error rate、latency、business metrics）

## 相关模式

- `kubernetes/`：K8s 部署配置
- `ci-cd/github-actions/`：CI/CD 流水线
- `monitoring-observability/prometheus/`：部署时监控