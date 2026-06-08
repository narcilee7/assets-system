# DevOps

DevOps 能力目标是构建可靠、可观测、安全的软件交付体系。涵盖从代码提交到生产部署的完整链路，以及线上问题的快速响应。

它不是只会写 YAML、配 Docker、跑 CI，而是能把交付链路组织成长期可维护、可改进的系统。

## 架构师能力模型

| 层级 | 能力 | 判断标准 |
| --- | --- | --- |
| L1 Tool Operator | 会用工具、跑通流程 | 单个工具能用 |
| L2 Pipeline Builder | 搭 CI/CD、自动化构建 | 流水线能跑通 |
| L3 Infrastructure as Code | IaC 管理资源、版本控制 | 基础设施可复现 |
| L4 Platform Engineering | 构建内部平台、自助服务 | 团队高效交付 |
| L5 Reliability Engineering | SLO/SLI、容量规划、容灾 | 系统长期可靠 |
| L6 Cloud-Native Architecture | 多云、混合云、成本优化 | 业务低成本高可用 |

## 主干

| 能力域 | 目录 | 训练目标 |
| --- | --- | --- |
| CI/CD | `ci-cd/` | GitHub Actions、GitLab CI、Jenkins |
| Container Orchestration | `container-orchestration/` | Docker Compose、Swarm |
| Kubernetes | `kubernetes/` | Pod、Service、Deployment、Helm |
| Infrastructure as Code | `iac/` | Terraform、Pulumi、Ansible |
| Monitoring & Observability | `monitoring-observability/` | Prometheus、Grafana、ELK |
| Deployment Strategies | `deployment-strategies/` | Blue-Green、Canary、金丝雀 |
| Incident Management | `incident-management/` | On-Call、Postmortem、MTTR |
| Secret Management | `secret-management/` | Vault、Sealed Secrets、KMS |
| Service Mesh | `service-mesh/` | Istio、Linkerd、Envoy |
| Cloud Platforms | `cloud-platforms/` | AWS、GCP、Azure 核心服务 |

## 核心追问

DevOps 架构师每个设计都要能回答：

```text
如何保证每次部署都是可重复的？
构建失败后如何快速回滚？
如何检测线上问题而不是等用户投诉？
如何让团队自助发布而不依赖运维？
secret 如何安全地注入到容器？
如何保证基础设施和代码一致？
灰度发布如何做，有什么风险？
```

## 核心资产清单

| 优先级 | 资产 | 目录 | 状态 |
| --- | --- | --- | --- |
| P0 | GitHub Actions CI/CD | `ci-cd/github-actions/` | done |
| P0 | Docker multi-stage build | `container-orchestration/docker/` | done |
| P0 | Kubernetes Pod/Service/Deployment | `kubernetes/core-concepts/` | done |
| P0 | Terraform module | `iac/terraform/` | done |
| P0 | Prometheus metrics pipeline | `monitoring-observability/prometheus/` | done |
| P1 | Helm chart template | `kubernetes/helm/` | done |
| P1 | Blue-Green / Canary deployment | `deployment-strategies/` | done |
| P1 | Incident runbook template | `incident-management/` | done |
| P1 | Vault / Sealed Secrets | `secret-management/` | done |
| P1 | AWS EKS cluster setup | `cloud-platforms/aws/` | done |
| P1 | Service Mesh (Istio/Linkerd) | `service-mesh/` | done |

## 训练路径

```text
Docker 基础
-> Docker Compose 多容器编排
-> Kubernetes 核心概念
-> GitHub Actions CI/CD
-> Terraform IaC
-> Prometheus + Grafana 监控
-> Blue-Green / Canary 部署
-> Vault 密钥管理
-> Service Mesh 流量管理
-> SRE 实践
```

## 和其他主线的关系

- `engineering/backend/`：后端服务需要 CI/CD 部署、监控告警
- `systems-engineering/`：操作系统、网络、存储基础
- `system-design/`：分布式系统的部署和运维视角
- `ai-fullstack/`：MLOps 流水线、模型部署