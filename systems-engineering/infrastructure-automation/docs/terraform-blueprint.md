# Terraform Blueprint

## 目标

理解 Infrastructure as Code（IaC）的核心实践：Terraform 的状态管理、资源编排、模块设计、多环境管理和漂移检测，以及生产级 Terraform 的工程规范。

## 场景

- Terraform state 文件为什么不能让多人同时修改？
- 多环境（dev/staging/prod）怎么管理 terraform 配置？
-  sensitive 数据怎么安全地传入 terraform？
- terraform plan 通过了，apply 却失败了怎么办？
- 团队怎么协作使用 Terraform 而不互相踩？

## Terraform 核心概念

### 状态（State）

```
Terraform 用 state 文件记录实际基础设施的映射：

  配置（desired）          state（actual）          真实世界
  aws_instance.web {
    ami = "ami-123"
    instance_type = "t3.micro"
  }                      ──►  {
                            "aws_instance.web": {
                              "id": "i-abc123",
                              "ami": "ami-123",
                              ...
                            }
                          }

state 的作用：
  1. 映射资源名和云厂商的远程 ID
  2. 存储资源间的依赖关系
  3. 缓存远程属性（减少 API 调用）
  4. 检测配置漂移（drift）

state 文件：terraform.tfstate（JSON 格式）
  - 本地开发：本地文件
  - 团队协作：远程后端（S3 + DynamoDB、Terraform Cloud）
```

### 状态锁

```
问题：多人同时 terraform apply → state 冲突 → 数据损坏

解决：状态锁（State Locking）

S3 Backend + DynamoDB：
  terraform {
    backend "s3" {
      bucket         = "my-terraform-state"
      key            = "prod/vpc.tfstate"
      region         = "us-east-1"
      encrypt        = true
      dynamodb_table = "terraform-locks"
    }
  }

流程：
  1. terraform plan/apply 时，DynamoDB 写入锁记录
  2. 其他人尝试操作时，发现锁存在，等待或报错
  3. 操作完成后，释放锁

强制解锁（紧急情况）：
  terraform force-unlock <LOCK_ID>
```

### 执行计划（Plan）

```
terraform plan：
  1. 读取当前配置（.tf 文件）
  2. 读取远程 state
  3. 调用云厂商 API 获取实际资源状态
  4. 计算差异（diff）
  5. 输出执行计划：

    Terraform will perform the following actions:

      + create    (新增)
      ~ update    (修改)
      - destroy   (删除)
      +/- replace (先删后建)

关键：plan 必须 review 后才能 apply
```

## 项目结构

### 推荐布局

```
terraform/
├── modules/                    # 可复用模块
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── eks/
│   ├── rds/
│   └── s3-bucket/
│
├── environments/               # 环境特定配置
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   └── prod/
│
├── global/                     # 全局资源（DNS、IAM）
│   └── iam/
│
└── policies/                   # Sentinel / OPA 策略
    └── restrict-regions.sentinel
```

### 模块设计原则

```
好的 Terraform 模块：

1. 单一职责：
   - vpc 模块只管 VPC，不管 EC2
   - 通过组合多个模块构建完整系统

2. 明确接口：
   - variables.tf：输入参数（带 validation）
   - outputs.tf：输出值
   - 不暴露内部实现细节

3. 合理默认值：
   - 常见场景开箱即用
   - 复杂场景允许自定义

4. 文档：
   - README.md 说明用途、用法、示例
   - 每个变量的说明和约束

反模式：
  - 巨型模块（几百行资源定义）
  - 过度抽象（每个参数都暴露）
  - 硬编码环境差异（用 if/else 判断 env）
```

## 多环境管理

### Workspace 模式

```bash
# Terraform Workspace
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

terraform workspace select dev
terraform plan
```

```
特点：
  - 同一配置，不同 state 文件
  - 适合环境差异小的场景

局限：
  - 容易误操作（忘记切换 workspace）
  - 不适合差异大的环境（prod 用多 AZ，dev 用单 AZ）
  - 代码中用 terraform.workspace 判断环境 → 反模式
```

### 目录隔离模式（推荐）

```
environments/
  dev/
    main.tf      → module.vpc { azs = ["a"] }
    backend.tf   → key = "dev/terraform.tfstate"
  staging/
    main.tf      → module.vpc { azs = ["a", "b"] }
    backend.tf   → key = "staging/terraform.tfstate"
  prod/
    main.tf      → module.vpc { azs = ["a", "b", "c"] }
    backend.tf   → key = "prod/terraform.tfstate"

特点：
  - 环境完全隔离（不同目录、不同 state）
  - 可以有不同的配置和版本
  - CI/CD 按目录触发
  - 最常用，最不容易出错
```

## 变量与 Secrets

### 变量传递

```hcl
# variables.tf
variable "db_password" {
  description = "Database admin password"
  type        = string
  sensitive   = true
  
  validation {
    condition     = length(var.db_password) >= 12
    error_message = "Password must be at least 12 characters."
  }
}

# 传递方式（按优先级）：
# 1. 命令行：-var="db_password=secret"
# 2. 环境变量：TF_VAR_db_password=secret
# 3. tfvars 文件：terraform.tfvars
# 4. 默认值
```

### Secrets 管理

```
不推荐：
  - 直接写在 .tf 文件
  - 提交到 Git
  - 明文放在 tfvars

推荐方案：

1. 环境变量（开发/CI）：
   export TF_VAR_db_password="$(aws secretsmanager get-secret-value ...)"

2. Vault / AWS Secrets Manager：
   data "aws_secretsmanager_secret_version" "db" {
     secret_id = "prod/db/password"
   }
   
   locals {
     db_password = jsondecode(data.aws_secretsmanager_secret_version.db.secret_string)["password"]
   }

3. Terraform Cloud / HCP Vault：
   - 变量集（Variable Sets）存储敏感值
   - 加密存储，权限控制

4. SOPS + Age：
   - 加密 tfvars 文件
   - 提交到 Git 安全
   - CI 用密钥解密
```

## 漂移检测

### 什么是 Drift？

```
配置漂移：真实基础设施和 Terraform 配置不一致

原因：
  - 人工控制台修改（ClickOps）
  - 其他自动化工具修改
  - 云厂商自动升级

检测：
  terraform plan -detailed-exitcode
  # 0 = 无漂移
  # 1 = 错误
  # 2 = 有漂移

自动化：
  - 定时任务（ nightly ）运行 plan
  - 检测到漂移 → 告警 → 手动修复或自动 reconcile
```

### 防止漂移

```
1. 权限控制：
   - 禁止直接控制台修改生产环境
   - 所有变更通过 Terraform

2. 自动化：
   - Terraform Cloud 的 drift detection
   - 自定义 Lambda/Function 定期检测

3. Policy as Code：
   - Sentinel / OPA 阻止不合规的变更
   - 云厂商 SCP（Service Control Policy）
```

## 团队协作

### 工作流

```
GitOps 风格工作流：

  Developer                    Terraform Cloud / CI
     │                                │
     ├── 修改 .tf 文件 ──────────────►│
     ├── git commit & push ──────────►│
     │                                │
     │◄── CI runs terraform plan ─────│
     │    (检查语法、安全、成本)         │
     │                                │
     ├── PR Review ─────────────────►│
     │    (plan 结果必须 review)       │
     │                                │
     ├── Merge to main ─────────────►│
     │                                │
     │◄── Auto apply (dev/staging) ───│
     │◄── Manual apply (prod) ────────│
```

### CI/CD 集成

```yaml
# GitHub Actions 示例
name: Terraform
on:
  push:
    branches: [main]
  pull_request:
    paths: ['terraform/**']

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      
      - run: terraform fmt -check
      - run: terraform init
      - run: terraform validate
      - run: terraform plan -out=tfplan
      
      - name: Upload Plan
        uses: actions/upload-artifact@v4
        with:
          name: tfplan
          path: tfplan

  apply:
    needs: plan
    if: github.ref == 'refs/heads/main'
    environment: production  # 需要人工审批
    steps:
      - run: terraform apply tfplan
```

## 核心追问

1. **terraform state 文件泄露有什么风险？** state 文件包含所有资源的敏感属性（如数据库密码、私钥），泄露等于基础设施裸奔；必须加密存储（S3 SSE、Terraform Cloud encryption）
2. **为什么 terraform apply 可能失败即使 plan 通过了？** plan 和 apply 之间有时间差；云厂商资源可能被删除、配额不足、并发修改、API 限流；生产环境应 plan 后立即 apply，减少时间窗口
3. **Terraform 和 Ansible 怎么分工？** Terraform 负责基础设施的创建和销毁（编排）；Ansible 负责配置和软件安装（配置管理）；Terraform 输出连接信息，Ansible 用 Dynamic Inventory 消费
4. **Module 版本怎么管理？** 用 Git tag 或 Terraform Registry 版本化；生产环境锁定 module 版本（source = "...?ref=v1.2.3"），避免意外升级
5. **state 文件太大（ tens of MB ）怎么优化？** 拆分 state（按服务/团队拆分 backend key）、减少数据源（data source）使用、用 terraform state rm 清理已不管理的资源、定期归档历史资源

## 状态

| 资产 | 状态 |
|---|---|
| Terraform blueprint | done |
| GitOps workflow | todo |
| config and secret layering | todo |
| deployment rollback playbook | todo |
| policy as code notes | todo |
