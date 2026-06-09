# Deploy / Platform

## 部署选项

| 平台 | 适合 | 注意 |
| --- | --- | --- |
| Docker + Compose | 中小团队、开发环境 | 镜像优化、多层构建 |
| PM2 | 传统 VM / 裸金属 | 集群模式、日志切割 |
| Kubernetes | 大规模容器编排 | 学习曲线、运维成本 |
| Serverless (Lambda) | 低流量、突发流量 | 冷启动、连接池 |
| Edge (Vercel / Cloudflare) | 全球低延迟 | Runtime 限制 |

## 资产

| 资产 | 目录 | 说明 |
| --- | --- | --- |
| Docker multi-stage build | `docker/` | Alpine、多阶段、dumb-init、健康检查、docker-compose |
| PM2 process management | `pm2/` | cluster 模式、配置、平滑重启、监控 |
| Serverless deployment | `serverless/` | Lambda、冷启动优化、Edge Runtime |
| Kubernetes manifests | `k8s/` | Deployment、HPA、零停机滚动更新、探针 |
| GitHub Actions CI/CD | `github-actions/` | lint/test/security/build/push/deploy 完整流水线 |
