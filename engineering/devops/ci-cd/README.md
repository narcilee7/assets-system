# CI/CD

CI/CD 能力覆盖从代码提交到生产部署的自动化流水线。

## 目录结构

```
ci-cd/
├── github-actions/     # GitHub Actions 流水线
└── gitlab-ci/         # GitLab CI 流水线
```

## 核心概念

| 概念 | 解释 |
| --- | --- |
| CI (Continuous Integration) | 持续集成：代码提交自动构建和测试 |
| CD (Continuous Delivery) | 持续交付：自动发布到测试环境 |
| CD (Continuous Deployment) | 持续部署：自动发布到生产 |
| Pipeline | 流水线：一系列自动化步骤 |
| Artifact | 构建产物：Docker 镜像、TAR 包等 |

## CI/CD 流程

```
Code Commit
    │
    ▼
┌─────────┐
│  Build  │ ← 依赖安装、代码编译
└────┬────┘
     │
     ▼
┌─────────┐
│  Test   │ ← 单元测试、集成测试
└────┬────┘
     │
     ▼
┌─────────┐
│  Lint   │ ← 代码风格检查
└────┬────┘
     │
     ▼
┌─────────┐
│  Build  │ ← Docker 镜像构建
│  Image  │
└────┬────┘
     │
     ▼
┌─────────┐
│  Scan   │ ← 安全扫描、漏洞扫描
└────┬────┘
     │
     ▼
┌─────────┐
│  Push   │ ← 推送到镜像仓库
└────┬────┘
     │
     ▼
┌─────────┐
│ Deploy  │ ← 部署到环境（Staging/Production）
│ Staging │
└────┬────┘
     │
     ▼
┌─────────┐
│ Smoke   │ ← 冒烟测试
│ Test    │
└────┬────┘
     │
     ▼
┌─────────┐
│ Deploy  │
│ Prod    │
└─────────┘
```

## 平台对比

| 平台 | 优点 | 缺点 |
| --- | --- | --- |
| GitHub Actions | 云原生、与 GitHub 深度集成 | 自定义有限 |
| GitLab CI | 功能丰富、Self-hosted 灵活 | 配置复杂 |
| Jenkins | 高度可定制 | 维护成本高 |
| ArgoCD | GitOps 原生 | 需要手动配置 |
| Spinnaker | 多云支持、复杂部署 | 学习曲线陡 |

## 相关目录

- `../container-orchestration/docker/`：镜像构建
- `../kubernetes/`：K8s 部署
- `../monitoring-observability/`：部署后监控
- `../deployment-strategies/`：部署策略