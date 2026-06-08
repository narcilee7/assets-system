# 安全基础

## 1. OWASP Top 10 (2021)

| 排名 | 风险 | 描述 | 防御措施 |
|------|------|------|----------|
| A01 | 失效的访问控制 | 越权访问、目录遍历、IDOR | RBAC、最小权限、资源级授权 |
| A02 | 加密机制失效 | 明文传输、弱算法、密钥硬编码 | TLS 1.3、强密码算法、密钥管理 |
| A03 | 注入 | SQL 注入、NoSQL 注入、OS 命令注入 | 参数化查询、ORM、输入验证 |
| A04 | 不安全设计 | 业务逻辑缺陷、架构漏洞 | 威胁建模、安全设计模式 |
| A05 | 安全配置错误 | 默认密码、调试信息泄露、不必要功能 | 加固基线、自动化扫描 |
| A06 | 易受攻击的组件 | 过时的库、存在 CVE 的依赖 | SCA 工具、依赖更新策略 |
| A07 | 身份识别与认证失效 | 弱密码、会话劫持、暴力破解 | MFA、密码策略、速率限制 |
| A08 | 软件和数据完整性失效 | 不安全的反序列化、供应链攻击 | 签名验证、依赖锁定 |
| A09 | 安全日志与监控失效 | 无审计日志、无法检测入侵 | 集中日志、SIEM、告警 |
| A10 | 服务器端请求伪造 (SSRF) | 服务端访问内网资源 | URL 白名单、禁用不需要协议 |

```
安全开发生命周期 (SDL)

需求阶段          设计阶段           开发阶段           测试阶段           发布阶段           运营阶段
  │                │                │                │                │                │
  ▼                ▼                ▼                ▼                ▼                ▼
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 安全需求  │───▶│ 威胁建模 │───▶│ 安全编码 │───▶│ 安全测试 │───▶│ 安全发布 │───▶│ 应急响应 │
│ 分析     │    │ STRIDE  │    │ 规范    │    │ SAST/DAST│    │ 加固    │    │ 监控    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

## 2. 威胁建模 STRIDE

```
STRIDE 威胁分类

S - Spoofing（欺骗）
    ├── 攻击者冒充其他用户或系统
    └── 防御：认证、数字签名

T - Tampering（篡改）
    ├── 修改数据或代码
    └── 防御：完整性校验、数字签名、访问控制

R - Repudiation（否认）
    ├── 用户否认执行过的操作
    └── 防御：审计日志、不可否认性机制

I - Information Disclosure（信息泄露）
    ├── 暴露敏感信息给未授权用户
    └── 防御：加密、最小权限、错误处理

D - Denial of Service（拒绝服务）
    ├── 使系统不可用
    └── 防御：速率限制、资源配额、冗余

E - Elevation of Privilege（权限提升）
    ├── 获得本不应有的权限
    └── 防御：最小权限、输入验证、沙箱
```

```
数据流图 (DFD) + 威胁建模

外部实体           进程              数据存储
   │               │                  │
   ▼               ▼                  ▼
┌─────┐        ┌───────┐         ┌─────────┐
│用户 │───────▶│ Web  │────────▶│ 数据库  │
└─────┘        │ 服务  │         └─────────┘
               └───────┘
                  │
                  ▼
               ┌───────┐
               │ 缓存  │
               └───────┘

信任边界：
- 用户 ↔ Web 服务：不信任边界
- Web 服务 ↔ 数据库：信任边界内
- Web 服务 ↔ 缓存：信任边界内

威胁分析示例：
- 数据流：用户 → Web 服务（HTTP）
  - S：中间人攻击 → TLS
  - T：请求篡改 → 签名/HMAC
  - I：凭证泄露 → 加密传输
  - D：CC 攻击 → 速率限制
```

## 3. 安全左移

```
DevSecOps 流水线

代码提交
  │
  ▼
┌─────────────┐
│ SAST 扫描   │  SonarQube / CodeQL / Semgrep
│ (静态分析)   │  → 漏洞、坏实践、密钥泄露
└─────────────┘
  │
  ▼
┌─────────────┐
│ 依赖扫描    │  Snyk / OWASP Dependency-Check / npm audit
│ (SCA)       │  → 已知 CVE、许可证风险
└─────────────┘
  │
  ▼
构建镜像
  │
  ▼
┌─────────────┐
│ 镜像扫描    │  Trivy / Clair / Snyk Container
│             │  → OS 漏洞、应用漏洞、密钥
└─────────────┘
  │
  ▼
部署
  │
  ▼
┌─────────────┐
│ DAST 扫描   │  OWASP ZAP / Burp Suite
│ (动态分析)   │  → 运行时的安全漏洞
└─────────────┘
  │
  ▼
┌─────────────┐
│ 运行时防护   │  RASP / Falco
│             │  → 异常行为检测
└─────────────┘
```

```yaml
# GitHub Actions 安全流水线示例
name: Security Scan

on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/cwe-top-25

  sca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t app:${{ github.sha }} .
      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: app:${{ github.sha }}
          severity: CRITICAL,HIGH
```
