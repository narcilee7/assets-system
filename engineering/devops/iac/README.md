# Infrastructure as Code

IaC 覆盖基础设施的代码化管理。

## 目录结构

```
iac/
└── terraform/     # Terraform 模块
```

## 核心概念

| 概念 | 解释 |
| --- | --- |
| State | 资源映射状态文件 |
| Provider | 云平台插件 |
| Resource | 基础设施对象 |
| Data Source | 只读查询 |
| Module | 可复用配置包 |
| Backend | State 存储方式 |

## IaC 工具对比

| 工具 | 类型 | 优点 | 缺点 |
| --- | --- | --- | --- |
| Terraform | 声明式 | 多云支持、状态管理 | HCL 学习曲线 |
| Pulumi | 声明式/命令式 | 代码化（TS/Python） | 生态较小 |
| Ansible | 命令式 | 简单易用 | 无状态管理 |
| CloudFormation | 声明式（AWS） | 原生支持 | 只能 AWS |

## 最佳实践

```bash
# 1. 目录结构
terraform/
├── environments/
│   ├── prod/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── staging/
│       └── ...
└── modules/
    ├── vpc/
    ├── eks/
    └── rds/

# 2. State 管理（生产必须远程）
terraform {
  backend "s3" {
    bucket = "tf-state-prod"
    key    = "prod/main.tfstate"
    region = "us-east-1"
  }
}

# 3. 锁定版本
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# 4. 格式化代码
terraform fmt

# 5. 验证配置
terraform validate

# 6. 规划变更
terraform plan

# 7. 应用变更
terraform apply
```

## 相关目录

- `terraform/`：Terraform 模块
- `cloud-platforms/`：云平台集成
- `secret-management/`：密钥管理