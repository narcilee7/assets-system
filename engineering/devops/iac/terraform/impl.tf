# Terraform Provider Configuration
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "my-terraform-state-prod"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "production"
      ManagedBy   = "Terraform"
    }
  }
}

# VPC Module
module "vpc" {
  source = "./modules/networking/vpc"

  environment = "production"
  vpc_cidr    = "10.0.0.0/16"
}

# EKS Module
module "eks" {
  source = "./modules/eks"

  cluster_name       = "myapp-prod"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = concat(module.vpc.private_subnet_ids, module.vpc.public_subnet_ids)
  eks_version        = "1.28"
  node_instance_type = "t3.medium"
  node_desired_size  = 3
}

# RDS Module
module "rds" {
  source = "./modules/database/rds"

  db_name     = "myappdb"
  db_username = "dbadmin"
  db_password = var.db_password
  subnet_ids  = module.vpc.private_subnet_ids
  vpc_id      = module.vpc.vpc_id
}

variable "db_password" {
  description = "Database password"
  sensitive   = true
}

output "eks_cluster_endpoint" {
  value     = module.eks.cluster_endpoint
  sensitive = false
}

output "rds_endpoint" {
  value     = module.rds.rds_endpoint
  sensitive = true
}