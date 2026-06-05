# GitOps Workflow

## 目标

理解 GitOps 的核心范式：声明式基础设施、Git 作为唯一事实来源、自动同步和回滚，以及 ArgoCD、Flux 等工具的工程实践。

## 场景

- GitOps 和传统 CI/CD 推送部署有什么区别？
- ArgoCD 的自动同步和手动同步怎么选？
- Git 回滚等于应用回滚吗？
- 多集群环境怎么管理 ArgoCD Application？
- Secret 怎么在 GitOps 中安全地管理？

## GitOps 核心原则

### 推模式 vs 拉模式

```
传统 CI/CD（推模式）：
  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │   Git   │──►  │   CI    │──►  │  K8s    │
  │         │     │ (Jenkins)│     │ (kubectl)│
  └─────────┘     └─────────┘     └─────────┘

  问题：
    - CI 需要集群访问凭证（credential 扩散）
    - 网络分区时无法部署
    - 难以感知集群实际状态

GitOps（拉模式）：
  ┌─────────┐                     ┌─────────┐
  │   Git   │◄────────────────────│ ArgoCD  │
  │(Desired)│  GitOps Agent 拉取   │(Agent)  │
  └─────────┘                     └────┬────┘
                                       │
                                  ┌────┴────┐
                                  ▼         ▼
                               ClusterA  ClusterB

  优势：
    - 集群凭证不离开集群
    - Git 是唯一事实来源
    - 自动漂移检测和自愈
    - 天然支持回滚（git revert）
```

### 四大原则（Weaveworks 定义）

```
1. 声明式系统（Declarative）
   - 用 YAML/JSON 描述期望状态
   - 不是命令式脚本（kubectl apply 一堆命令）

2. 版本化、不可变（Versioned & Immutable）
   - 所有配置在 Git 中版本控制
   - 变更历史可追溯、可审计

3. 自动拉取（Pulled Automatically）
   - GitOps Agent 持续监控 Git 仓库
   - 检测到差异自动同步

4. 持续协调（Continuously Reconciled）
   - 实际状态持续向期望状态收敛
   - 人工修改会被自动回正（自愈）
```

## ArgoCD 架构

### 核心组件

```
┌─────────────────────────────────────────┐
│              ArgoCD Server               │
│  - API Server（UI/CLI/gRPC）             │
│  - Repository Server（Git 缓存、Helm/Kustomize）│
│  - Application Controller（协调循环）      │
└─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    Git Repo    K8s API      Other
   (Desired)   (Actual)    (Clusters)

Application Controller：
  - 每 3 分钟（默认）轮询 Git 仓库
  - 对比 Git 状态（Desired）和 K8s 状态（Actual）
  - 差异 → 执行同步（Sync）
  - 支持事件驱动（Webhook）减少轮询延迟
```

### Application CRD

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/gitops-repo.git
    targetRevision: main
    path: apps/my-app/overlays/prod
    kustomize:
      namePrefix: prod-
  destination:
    server: https://kubernetes.default.svc
    namespace: prod
  syncPolicy:
    automated:
      prune: true        # 删除 Git 中不存在的资源
      selfHeal: true     # 自动修复漂移
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

## 同步策略

### 自动同步（Auto-Sync）

```
适用：开发环境、非关键服务

行为：
  - Git push → ArgoCD 自动 apply
  -  drift（人工修改）→ 自动恢复

风险：
  - 错误的 Git commit 直接进生产
  - 难以控制发布节奏
  
缓解：
  - 自动同步只用于 dev/staging
  - production 用手动同步 + 审批
```

### 手动同步（Manual Sync）

```
适用：生产环境、关键服务

流程：
  1. Git PR → Code Review
  2. Merge → ArgoCD 检测 OutOfSync
  3. 人工在 UI/CLI 点击 Sync（或定时窗口）
  4. 可选：PreSync / PostSync Hook 验证

ArgoCD 的 Sync Window：
  - 只允许特定时间段同步（如工作日 9-18 点）
  - 防止深夜意外发布
```

### 同步钩子（Hooks）

```yaml
# PreSync：同步前执行（如数据库迁移）
apiVersion: batch/v1
kind: Job
metadata:
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: migrate-tool
          command: ["migrate", "up"]

# PostSync：同步后执行（如健康检查、通知）
apiVersion: batch/v1
kind: Job
metadata:
  annotations:
    argocd.argoproj.io/hook: PostSync
spec:
  template:
    spec:
      containers:
        - name: notify
          image: curlimages/curl
          command: ["curl", "-X", "POST", "webhook-url"]
```

## 回滚策略

### Git 回滚

```
GitOps 的回滚就是 Git 回滚：

  git revert <bad-commit>
  git push
  
  → ArgoCD 检测到变更
  → 自动同步到旧版本

优势：
  - 回滚速度 = Git 推送速度
  - 历史记录完整
  - 所有人可见变更原因

注意：
  - 数据库 schema 变更可能不可逆
  - 需要 PreSync Hook 处理数据迁移
```

### 蓝绿 / 金丝雀回滚

```
Argo Rollouts（ArgoCD 生态）：

  kind: Rollout
  spec:
    strategy:
      canary:
        steps:
          - setWeight: 20
          - pause: {duration: 10m}
          - setWeight: 50
          - pause: {duration: 10m}
          - setWeight: 100
        analysis:
          templates:
            - templateName: success-rate
          args:
            - name: service-name
              value: my-service

回滚：
  - 自动：analysis 失败 → 自动回退到稳定版本
  - 手动：kubectl argo rollouts undo
```

## 多集群管理

### ApplicationSet

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: my-app
spec:
  generators:
    - list:
        elements:
          - cluster: dev
            url: https://dev-k8s.example.com
          - cluster: staging
            url: https://staging-k8s.example.com
          - cluster: prod
            url: https://prod-k8s.example.com
  template:
    metadata:
      name: '{{cluster}}-my-app'
    spec:
      source:
        repoURL: https://github.com/org/gitops.git
        targetRevision: main
        path: 'apps/my-app/overlays/{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: my-app
```

### 集群 Secret

```
ArgoCD 管理多集群：

  1. ArgoCD 所在集群（Control Plane）
  2. 业务集群（Managed Clusters）

连接方式：
  - 在 ArgoCD 集群中创建 Secret，包含目标集群的 kubeconfig
  - ArgoCD 用这些凭证连接各集群执行同步

安全：
  - 集群凭证只存在于 ArgoCD 命名空间
  -  RBAC 限制谁能创建/修改 Application
```

## Secret 管理

### 不直接存 Secret 在 Git

```
问题：Git 是分布式的，Secret 入仓后无法真正删除

方案 1：External Secrets Operator（ESO）
  apiVersion: external-secrets.io/v1beta1
  kind: ExternalSecret
  metadata:
    name: db-credentials
  spec:
    secretStoreRef:
      name: aws-secrets-manager
      kind: SecretStore
    target:
      name: db-credentials
    data:
      - secretKey: password
        remoteRef:
          key: prod/db/password

  → ArgoCD 同步 ExternalSecret CR
  → ESO 从 AWS Secrets Manager 拉取真实值
  → 生成 K8s Secret

方案 2：Sealed Secrets
  - 用 kubeseal 加密 Secret
  - 只有集群内控制器能解密
  - 加密后的 SealedSecret 可以安全入仓

方案 3：SOPS
  - 用 Age/AWS KMS/GPG 加密 YAML
  - 提交加密文件到 Git
  - ArgoCD 用 KSOPS 插件解密
```

## 核心追问

1. **GitOps 的自动 selfHeal 会不会把合理的临时修改也回滚？** 会。如果运维人员为了应急手动 kubectl edit，selfHeal 会在下一次协调周期恢复；建议应急时先暂停 Auto-Sync，或设置 sync window
2. **ArgoCD 和 Helm 的关系？** ArgoCD 原生支持 Helm，但不用 Tiller；ArgoCD 本地渲染 Helm template，然后 apply；支持 Helm values 文件、参数覆盖
3. **GitOps 怎么管理 Terraform？** ArgoCD 不直接管 Terraform；方案：1）用 Crossplane（K8s 风格的云资源编排）；2）用 Terraform Controller 把 Terraform 封装成 K8s CRD；3）Terraform 和 ArgoCD 分开，Terraform 输出写入 Git，ArgoCD 同步 K8s 部分
4. **多租户 ArgoCD 怎么隔离？** ArgoCD Projects 隔离：不同团队不同 Project，限制可部署的集群、命名空间、Git 仓库；配合 RBAC 控制用户权限
5. **GitOps 下数据库迁移怎么处理？** 用 PreSync Job 执行迁移；但回滚时迁移不可逆；推荐：先向后兼容的 schema 变更（加列不改旧列），应用回滚后仍兼容；大迁移单独计划，不在 GitOps 自动流程中

## 状态

| 资产 | 状态 |
|---|---|
| Terraform blueprint | done |
| GitOps workflow | done |
| config and secret layering | todo |
| deployment rollback playbook | todo |
| policy as code notes | todo |
