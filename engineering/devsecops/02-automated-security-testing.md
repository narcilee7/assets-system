# 自动化安全测试

## 1. SAST（静态应用安全测试）

```
SAST 工具
├── 商业：SonarQube、Checkmarx、Veracode、Fortify
├── 开源：Semgrep、CodeQL、Bandit、Brakeman、SpotBugs
└── 集成方式：
    ├── IDE 插件（实时反馈）
    ├── Pre-commit hook（提交前阻断）
    └── CI/CD 流水线（PR 检查）

Semgrep 规则集
├── p/security-audit：通用安全审计
├── p/owasp-top-ten：OWASP Top 10
├── p/cwe-top-25：CWE Top 25
├── p/ci：密钥和凭证泄露
├── p/python：Python 安全
├── p/javascript：JavaScript 安全
└── 自定义规则：企业特定的安全模式
```

```yaml
# .semgrep.yml
rules:
  - id: detect-sql-injection
    patterns:
      - pattern-either:
          - pattern: |
              $QUERY = "..." + $VAR
              ...
              $DB.execute($QUERY)
    languages:
      - python
    message: "Possible SQL injection"
    severity: ERROR

  - id: detect-hardcoded-secret
    patterns:
      - pattern-regex: '(api[_-]?key|secret|password)\s*=\s*["\'][^"\']{8,}["\']'
    languages:
      - generic
    message: "Hardcoded secret detected"
    severity: WARNING
```

## 2. DAST（动态应用安全测试）

```
DAST 工具
├── 开源：OWASP ZAP、Nikto、Arachni
├── 商业：Burp Suite Enterprise、Acunetix、Netsparker
└── 扫描方式：
    ├── 基线扫描：快速，适合 CI
    ├── 完整扫描：全面，适合测试环境
    └── API 扫描：针对 REST/GraphQL

ZAP 自动化
├── zap-baseline.py：基线扫描（被动）
├── zap-full-scan.py：完整扫描（主动）
└── zap-api-scan.py：API 扫描
```

```yaml
# GitHub Actions ZAP 扫描
- name: ZAP Baseline Scan
  uses: zaproxy/action-baseline@v0.12.0
  with:
    target: 'https://staging.example.com'
    rules_file_name: '.zap/rules.tsv'
    cmd_options: '-a'
```

## 3. SCA（软件成分分析）

```
SCA 工具
├── 开源：OWASP Dependency-Check、npm audit、pip-audit、Trivy
├── 商业：Snyk、Black Duck、FOSSA、Mend
└── 检测能力：
    ├── 已知 CVE
    ├── 许可证合规
    ├── 过时的依赖
    └── 恶意包（typosquatting）

SBOM（Software Bill of Materials）
├── 标准：SPDX、CycloneDX
├── 格式：JSON/XML
└── 用途：
    ├── 漏洞影响分析
    ├── 许可证审计
    └── 供应链追踪
```

```bash
# 生成 SBOM
npm sbom --sbom-format cyclonedx-json
syft packages dir:. -o cyclonedx-json

# 扫描依赖漏洞
npm audit --audit-level=high
snyk test
pip-audit
```

## 4. 密钥检测

```
密钥泄露检测
├── Pre-commit：gitleaks、truffleHog、git-secrets
├── CI/CD：GitHub secret scanning、GitLab secret detection
├── 代码库扫描： truffleHog --regex --entropy=False
└── 监控：GitHub 自动通知推送的密钥
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

## 5. IaC 安全扫描

```
基础设施即代码安全
├── Terraform：tfsec、checkov、tflint
├── CloudFormation：cfn-lint、cfn-nag
├── Kubernetes：kube-bench、kube-hunter、OPA/Gatekeeper
└── Docker：Hadolint、Dockle
```

```bash
# Terraform 安全扫描
tfsec .
checkov --directory .

# Kubernetes 安全
kube-bench run --targets node
kubectl apply -f https://raw.githubusercontent.com/kyverno/kyverno/main/config/install.yaml
```
