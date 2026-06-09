# Kubernetes

容器编排平台核心概念和最佳实践。

## 目录结构

```
kubernetes/
├── core-concepts/   # 核心概念：Pod、Service、Deployment
└── helm/           # Helm Chart 模板
```

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Pod | 最小调度单元 |
| Service | 负载均衡和服务发现 |
| Deployment | Pod 声明式管理 |
| StatefulSet | 有状态应用 |
| DaemonSet | 每节点一个 Pod |
| Job/CronJob | 批处理任务 |
| ConfigMap/Secret | 配置和密钥 |
| PV/PVC | 持久化存储 |
| HPA | 自动扩缩容 |

## 相关目录

- `../container-orchestration/`：容器镜像
- `../deployment-strategies/`：部署策略
- `../service-mesh/`：服务网格
- `../monitoring-observability/`：监控