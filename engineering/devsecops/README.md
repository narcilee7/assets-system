# DevSecOps

DevSecOps 工程化训练 —— 达到"能将安全无缝嵌入 CI/CD 流水线、能自动化安全检测、能响应安全事件"的水平。

## 训练哲学

1. **安全是每个人的责任**：不是安全团队的独角戏，开发、运维、测试都要参与。
2. **自动化优于人工**：安全扫描必须自动化，否则无法规模化。
3. **左移 + 右移**：左移（开发阶段发现）降低成本，右移（运行时监控）捕获遗漏。
4. **快速反馈**：开发者提交代码后 5 分钟内得到安全反馈。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-sdl-pipeline.md](01-sdl-pipeline.md) | 安全开发生命周期：需求→设计→开发→测试→发布→运营 |
| [02-automated-security-testing.md](02-automated-security-testing.md) | 自动化安全测试：SAST、DAST、SCA、IaC 扫描、密钥检测 |
| [03-container-supply-chain.md](03-container-supply-chain.md) | 容器安全与供应链：镜像扫描、SBOM、签名验证、依赖治理 |
| [04-incident-response.md](04-incident-response.md) | 安全事件响应：检测、遏制、根除、恢复、复盘 |

## DevSecOps 流水线

```
开发者提交代码
     │
     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Pre-commit │────▶│   CI Build   │────▶│  Container   │
│   Hooks      │     │              │     │   Build      │
│  (gitleaks)  │     │  SAST + SCA  │     │              │
└──────────────┘     │  (Semgrep)   │     │  Image Scan  │
                     └──────────────┘     │  (Trivy)     │
                           │               └──────────────┘
                           ▼                      │
                     ┌──────────────┐            ▼
                     │   Test Env   │     ┌──────────────┐
                     │  DAST + Fuzz │     │   Registry   │
                     │   (ZAP)      │     │   (Sign)     │
                     └──────────────┘     └──────────────┘
                           │                      │
                           ▼                      ▼
                     ┌──────────────┐     ┌──────────────┐
                     │   Staging    │     │  Deployment  │
                     │  Pen Test    │     │   (IaC Scan) │
                     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │  Production  │
                                           │  RASP + SIEM │
                                           │  + Threat    │
                                           │  Intelligence│
                                           └──────────────┘
```
