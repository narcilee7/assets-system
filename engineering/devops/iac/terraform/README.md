# Terraform Module

## 目标

训练 Terraform IaC 编写：Provider、Resource、Data Source、Variable、Output、Module、State 管理。

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Provider | 云平台/服务接口 |
| Resource | 基础设施对象 |
| Data Source | 只读查询 |
| Variable | 输入参数 |
| Output | 输出值 |
| Module | 可复用配置包 |
| State | 资源映射状态 |

## 基础结构

```
terraform/
├── main.tf           # 主配置
├── variables.tf      # 变量定义
├── outputs.tf        # 输出定义
├── providers.tf      # Provider 配置
├── terraform.tfvars  # 变量值
└── modules/          # 本地模块
    └── networking/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

## Provider 配置

```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # 远程状态（生产必备）
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/main.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
```

## VPC 模块

```hcl
# modules/networking/vpc/main.tf
variable "environment" {}
variable "vpc_cidr" {}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.environment}-vpc"
    Environment = var.environment
  }
}

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "${var.environment}-private-${count.index + 1}"
    Type        = "private"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 3)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.environment}-public-${count.index + 1}"
    Type        = "public"
    Environment = var.environment
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}
```

## EKS 模块

```hcl
# modules/eks/cluster.tf
variable "cluster_name" {}
variable "vpc_id" {}
variable "subnet_ids" {}
variable "eks_version" {}

resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  version  = var.eks_version
  role_arn = aws_iam_role.cluster.arn

  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.cluster_policy
  ]
}

resource "aws_iam_role" "cluster" {
  name = "${var.cluster_name}-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

# Node Group
variable "node_instance_type" {}
variable "node_desired_size" {}

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.cluster_name}-nodes"
  node_role_arn   = aws_iam_role.nodes.arn
  subnet_ids      = var.subnet_ids
  instance_types  = [var.node_instance_type]

  scaling_config {
    desired_size = var.node_desired_size
    max_size     = var.node_desired_size * 2
    min_size     = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_policy,
    aws_eks_cluster.main
  ]
}

resource "aws_iam_role" "nodes" {
  name = "${var.cluster_name}-nodes-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.nodes.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "cluster_name" {
  value = aws_eks_cluster.main.name
}
```

## RDS 模块

```hcl
# modules/database/rds.tf
variable "db_name" {}
variable "db_username" {}
variable "db_password" {}
variable "subnet_ids" {}
variable "vpc_id" {}

resource "aws_db_instance" "main" {
  identifier     = var.db_name
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  deletion_protection = true  # 生产环境开启

  tags = {
    Name = var.db_name
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.db_name}-subnet"
  subnet_ids = var.subnet_ids

  tags = { Name = "${var.db_name}-subnet" }
}

resource "aws_security_group" "rds" {
  name        = "${var.db_name}-sg"
  description = "Security group for RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]  # VPC 内网
  }

  tags = { Name = "${var.db_name}-sg" }
}

output "rds_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}
```

## 使用模块

```hcl
# main.tf
module "vpc" {
  source = "./modules/networking/vpc"

  environment = "production"
  vpc_cidr    = "10.0.0.0/16"
}

module "eks" {
  source = "./modules/eks"

  cluster_name       = "myapp-prod"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = concat(module.vpc.private_subnet_ids, module.vpc.public_subnet_ids)
  eks_version        = "1.28"
  node_instance_type = "t3.medium"
  node_desired_size  = 3
}

module "rds" {
  source = "./modules/database/rds"

  db_name     = "myappdb"
  db_username = "dbadmin"
  db_password = var.db_password  # 从 secrets 获取
  subnet_ids  = module.vpc.private_subnet_ids
  vpc_id      = module.vpc.vpc_id
}

# variables.tf
variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

variable "db_password" {
  sensitive = true
}
```

## State 管理

```bash
# 本地 state（不推荐生产）
terraform init

# 远程 state（推荐）
terraform init -backend-config="bucket=my-terraform-state"

# 查看 state
terraform state list
terraform state show aws_vpc.main

# 手动修改 state（危险）
terraform state mv aws_vpc.main aws_vpc.prod

# 导入现有资源
terraform import aws_vpc.main vpc-12345

# 清理损坏的 state
terraform state rm aws_instance.deleted
```

## 面试追问

- Terraform 和 Ansible 的区别？
  （答：Terraform 是声明式的，描述最终状态；Ansible 是命令式的，按步骤执行）
- 如何避免 state 文件冲突？
  （答：使用远程 state + 状态锁（DynamoDB/S3））
- 如何管理多个环境？
  （答：workspace 或目录分离（prod/, staging/））
- 如何安全存储 secrets？
  （答：AWS Secrets Manager、Vault，或 terraform import 导入现有 secrets）

## 相关模式

- `kubernetes/`：K8s 部署
- `cloud-platforms/aws/`：AWS 核心服务
- `secret-management/`：密钥管理