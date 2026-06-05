# Policy as Code

## 目标

理解策略即代码的核心实践：将合规要求、安全基线和治理规则编码化，实现自动化的准入控制、漂移检测和持续合规。

## 场景

- 怎么防止开发者在生产环境创建公开 S3 Bucket？
- 谁应该在 CI 中阻止不合规的 Terraform 提交？
- OPA、Sentinel、Kyverno 怎么选？
- 策略和配置的边界在哪？
- 策略失败了是阻断还是告警？

## 策略即代码的核心思想

```
传统治理：
  文档规定 → 人工审查 → 定期审计 → 发现问题 → 事后整改
  
  问题：
    - 文档容易过时
    - 人工审查遗漏
    - 发现问题时影响已造成

策略即代码：
  规则编码 → 自动执行 → 实时阻断/告警 → 持续合规
  
  优势：
    - 和代码一样版本控制
    - CI/CD 自动验证
    - 统一标准，无人情因素
    - 即时反馈
```

## 策略执行点

```
开发阶段：
  ├── IDE 插件（实时提示）
  ├── Pre-commit Hook（本地拦截）
  └── PR Check（CI 验证）

构建阶段：
  ├── SAST/DAST（安全扫描）
  ├── 镜像扫描（CVE 检查）
  └── 基础设施扫描（Terraform plan 审查）

部署阶段：
  ├── Admission Controller（K8s 准入）
  ├── Terraform Policy Check（Sentinel/OPA）
  └── 云厂商 SCP（Service Control Policy）

运行时：
  ├── 网络策略（NetworkPolicy）
  ├── Pod 安全策略（PSA/Kyverno）
  └── 异常行为检测（Falco）
```

## 工具对比

| 工具 | 引擎 | 适用场景 | 执行点 | 云中立 |
|---|---|---|---|---|
| OPA / Gatekeeper | Rego | K8s 准入、通用授权 | K8s、Envoy、TF | 是 |
| Sentinel | HashiCorp DSL | Terraform、Vault、Nomad | HCP Enterprise | 否 |
| Kyverno | YAML | K8s 策略 | K8s Admission | 是 |
| Terraform Compliance | BDD (Gherkin) | Terraform plan | CI | 是 |
| Checkov | Python | IaC 扫描（TF/K8S/CloudFormation） | CI | 是 |
| Cloud Custodian | YAML | 多云资源审计 | 运行时 | 是 |

## OPA / Gatekeeper

### Rego 语言

```rego
# 禁止创建没有资源限制的 Pod
package k8srequiredresources

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %s must have memory limit", [container.name])
}

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.cpu
  msg := sprintf("Container %s must have CPU limit", [container.name])
}
```

```
Rego 特点：
  - 声明式（不是命令式）
  - 自动遍历集合
  - 否定即失败（negation as failure）
  - 内置 JSON 处理
```

### Gatekeeper 架构

```
K8s API Server
      │
      ├──► ValidatingWebhookConfiguration
      │         │
      │         ▼
      │    Gatekeeper Controller
      │         │
      │    ┌────┴────┐
      │    ▼         ▼
      │ ConstraintTemplate  Constraint
      │    │              │
      │    ▼              ▼
      │  Rego 代码      参数绑定
      │    │              │
      │    └──────┬───────┘
      │           ▼
      │       OPA 引擎评估
      │           │
      │      允许 / 拒绝
      ▼
  资源创建成功 / 失败
```

### Constraint 示例

```yaml
# 1. 定义模板（一次）
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresources
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResources
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredresources
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits.memory
          msg := sprintf("Container %s must have memory limit", [container.name])
        }

# 2. 应用约束
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredResources
metadata:
  name: require-resources
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces: ["production"]
```

## Kyverno

### YAML 原生策略

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resources
spec:
  validationFailureAction: Enforce  # Enforce 或 Audit
  rules:
    - name: check-memory-limit
      match:
        resources:
          kinds:
            - Pod
      validate:
        message: "Container must have memory limit"
        pattern:
          spec:
            containers:
              - resources:
                  limits:
                    memory: "?*"
```

```
Kyverno vs Gatekeeper：

Kyverno：
  - 纯 YAML，学习成本低
  - 内置常见策略（资源限制、标签、网络）
  - 和 K8s 原生集成好
  - 灵活度不如 Rego

Gatekeeper/OPA：
  - Rego 表达力强
  - 通用（不限 K8s）
  - 学习曲线陡峭
  - 适合复杂策略
```

## Sentinel（HashiCorp）

### Terraform 策略

```hcl
# require-vpc-flow-logs.sentinel
import "tfplan"

main = rule {
  all tfplan.resources.aws_vpc as _, vpcs {
    all vpcs as _, vpc {
      vpc.applied.enable_dns_hostnames is true
    }
  }
}

# 要求所有 S3 bucket 必须加密
import "tfplan"

main = rule {
  all tfplan.resources.aws_s3_bucket as _, buckets {
    all buckets as _, bucket {
      bucket.applied.server_side_encryption_configuration is not null
    }
  }
}
```

```
Sentinel 执行点：
  - Terraform Cloud / Enterprise：plan 后自动执行
  - 软强制（Advisory）：告警但允许通过
  - 硬强制（Mandatory）：阻断 apply
  - 治理强制（Governance）：组织级策略，无法覆盖
```

## 策略设计原则

### 渐进式 enforcement

```
阶段 1：Audit（审计模式）
  - 策略只告警，不阻断
  - 收集违规数据，评估影响面
  - 给团队适应期

阶段 2：Dry Run（模拟执行）
  - 显示如果 enforce 会阻断什么
  - 团队验证修复效果

阶段 3：Enforce（强制模式）
  - 阻断不合规的变更
  - 例外需审批流程

例外管理：
  - 白名单机制（特定命名空间、特定标签）
  - 临时豁免（TTL，如 7 天）
  - 审计追踪（谁批准的、为什么）
```

### 策略分层

```
组织级（Global）：
  - 所有团队必须遵守
  - 例：禁止公开 S3 bucket、必须加密
  - 无法被项目级覆盖

团队级（Team）：
  - 特定团队或项目
  - 例：必须打特定标签、必须使用特定镜像仓库

环境级（Environment）：
  - 按环境差异
  - 例：prod 必须资源限制，dev 可以宽松
```

## 核心追问

1. **策略阻断发布会不会影响业务迭代速度？** 会有一点，但好策略应该"默认安全"而非"默认限制"；Audit 模式过渡、清晰的错误信息、自助修复文档都能减少摩擦；长期看减少安全事件节省更多时间
2. **OPA 除了 K8s 还能用在哪？** 通用授权引擎：API 网关（Envoy ext_authz）、微服务授权、Terraform plan 审查、CI/CD 流水线决策、SQL 查询审计
3. **Kyverno 的 mutate 功能有什么风险？** mutate 自动修改资源（如自动加标签、自动注入 sidecar），可能导致预期外行为；建议先用 validate，mutate 需谨慎测试
4. **策略即代码和传统单元测试的区别？** 单元测试验证功能正确性；策略验证合规性和安全性；两者互补，策略关注"什么不能做"，测试关注"做了什么要正确"
5. **多云环境下策略怎么统一？** 用云中立工具（OPA、Checkov、Cloud Custodian）；组织级策略用 Rego/YAML 定义，通过不同适配器在各云执行；避免厂商锁定工具（如只用 AWS SCP）

## 状态

| 资产 | 状态 |
|---|---|
| Terraform blueprint | done |
| GitOps workflow | done |
| config and secret layering | done |
| deployment rollback playbook | done |
| policy as code notes | done |
