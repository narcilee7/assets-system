# Container Orchestration

容器编排覆盖容器运行时和本地编排工具。

## 目录结构

```
container-orchestration/
└── docker/     # Docker 最佳实践
```

## 核心概念

| 概念 | 解释 |
| --- | --- |
| Container | 轻量级虚拟化 |
| Image | 容器模板 |
| Layer | 镜像分层 |
| Volume | 持久化存储 |
| Network | 容器网络 |

## 相关目录

- `ci-cd/`：CI/CD 构建镜像
- `kubernetes/`：K8s 编排
- `service-mesh/`：服务网格