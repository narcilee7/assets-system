# AWS Cloud Platform

## 目标

训练 AWS 核心服务：EC2、RDS、S3、IAM、VPC、Lambda、CloudWatch。

## 核心服务

| 类别 | 服务 | 用途 |
| --- | --- | --- |
| Compute | EC2, ECS, EKS, Lambda | 计算资源 |
| Storage | S3, EBS, EFS | 对象/块/文件存储 |
| Database | RDS, DynamoDB, ElastiCache | 关系/NoSQL/缓存 |
| Network | VPC, ALB, Route53, CloudFront | 网络和CDN |
| Security | IAM, KMS, Secrets Manager | 身份和密钥 |
| Monitoring | CloudWatch, X-Ray | 监控和追踪 |

## VPC

```hcl
# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "prod-vpc" }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "prod-igw" }
}

# Public Subnet
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(aws_vpc.main.cidr_block, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "prod-public-${count.index + 1}" }
}

# Private Subnet
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 4, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "prod-private-${count.index + 1}" }
}

# NAT Gateway（用于 private subnet 出站）
resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "prod-public-rt" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = { Name = "prod-private-rt" }
}

# 关联子网到路由表
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
```

## EKS Cluster

```hcl
# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "prod-cluster"
  role_arn = aws_iam_role.cluster.arn
  version  = "1.28"

  vpc_config {
    subnet_ids              = concat(aws_subnet.public[*].id, aws_subnet.private[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [aws_iam_role_policy_attachment.cluster_policy]
}

# Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "prod-nodes"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = aws_subnet.private[*].id
  instance_types  = ["t3.medium"]

  scaling_config {
    desired_size = 3
    max_size     = 6
    min_size     = 1
  }

  labels = {
    environment = "production"
  }
}
```

## RDS PostgreSQL

```hcl
resource "aws_db_instance" "main" {
  identifier           = "prod-db"
  engine              = "postgres"
  engine_version      = "15.4"
  instance_class      = "db.t3.medium"
  allocated_storage   = 100
  max_allocated_storage = 500
  storage_encrypted   = true

  db_name  = "myapp"
  username = "dbadmin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  deletion_protection = true  # 生产必须开启

  tags = { Name = "prod-db" }
}

resource "aws_db_subnet_group" "main" {
  name       = "prod-db-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "rds" {
  name        = "prod-rds-sg"
  description = "RDS security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]  # 只允许 App 安全组访问
  }

  tags = { Name = "prod-rds-sg" }
}
```

## S3 + CloudFront

```hcl
# S3 Bucket
resource "aws_s3_bucket" "static" {
  bucket = "myapp-static-prod"

  tags = { Name = "myapp-static-prod" }
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket = aws_s3_bucket.static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront
resource "aws_cloudfront_distribution" "static" {
  origin {
    domain_name = aws_s3_bucket.static.bucket_regional_domain_name
    origin_id   = "static"
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD", "OPTIONS"]

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  price_class = "PriceClass_200"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = { Name = "myapp-cf" }
}

resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for static site"
}
```

## ALB + Target Group

```hcl
# ALB
resource "aws_lb" "main" {
  name               = "prod-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups   = [aws_security_group.alb.id]
  subnets           = aws_subnet.public[*].id

  enable_deletion_protection = true  # 生产开启

  tags = { Name = "prod-alb" }
}

# Target Group
resource "aws_lb_target_group" "app" {
  name     = "prod-app-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

# Listener
resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
```

## IAM Roles

```hcl
# EKS Cluster Role
resource "aws_iam_role" "cluster" {
  name = "prod-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

# App Role（给 Pod 使用）
resource "aws_iam_role" "app" {
  name = "prod-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity"
      Effect = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.main.arn }
      Condition = {
        StringEquals = {
          "${aws_iam_openid_connect_provider.main.url}:sub" = "system:serviceaccount:production:myapp"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "app" {
  name = "prod-app-policy"

  role = aws_iam_role.app.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = "arn:aws:s3:::myapp-bucket/*"
    }]
  })
}
```

## 面试追问

- VPC 设计原则？
  （答：公有子网放置 ELB/NAT/IGW，私有子网放置应用/数据库，公私网分离）
- RDS 为什么开启 deletion_protection？
  （答：防止误删除，生产必备）
- S3 + CloudFront 的好处？
  （答：边缘加速、HTTPS、缓存减少回源）

## 相关模式

- `iac/terraform/`：IaC 基础设施定义
- `kubernetes/`：EKS 部署
- `secret-management/`：密钥管理