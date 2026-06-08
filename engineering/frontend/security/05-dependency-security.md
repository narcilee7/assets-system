# 依赖安全工程化

## 1. npm audit 集成

```json
// package.json
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "audit:ci": "npm audit --audit-level=moderate"
  }
}
```

```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm audit --audit-level=moderate
        # 如果有高危漏洞，CI 会失败

  # 使用 better-npm-audit 自定义规则
  custom-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g better-npm-audit
      - run: npx better-npm-audit audit --exclude=1234,5678
        # 排除已知可接受的漏洞
```

## 2. Subresource Integrity（SRI）

```html
<!-- 第三方脚本必须带 integrity 哈希 -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous"
></script>

<link
  rel="stylesheet"
  href="https://cdn.example.com/style.css"
  integrity="sha384-def456..."
  crossorigin="anonymous"
/>
```

```bash
# 生成 SRI 哈希
openssl dgst -sha384 -binary lib.js | openssl base64 -A

# 或使用在线工具
# https://www.srihash.org/
```

```javascript
// 构建时自动注入 SRI（Webpack）
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

module.exports = {
  plugins: [
    new SubresourceIntegrityPlugin({
      hashFuncNames: ['sha384', 'sha512'],
    }),
  ],
};
```

## 3. Lockfile 安全

```bash
# 锁定依赖版本，防止恶意更新
npm ci  # 严格按 package-lock.json 安装

# 验证 lockfile 未被篡改
npm audit signatures  # npm v8.13+

# 检查 lockfile 中的可疑包
# 1. 检查是否有 typosquatting（名称混淆）
# 2. 检查是否有从未见过的包
# 3. 检查包的发布时间和下载量
```

```javascript
// lockfile 安全检查脚本
const fs = require('fs');

function auditLockfile(lockfilePath) {
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  const issues = [];

  for (const [name, pkg] of Object.entries(lockfile.packages || {})) {
    if (!pkg.resolved) continue;

    // 检查是否使用官方 registry
    if (!pkg.resolved.startsWith('https://registry.npmjs.org/')) {
      issues.push(`Suspicious registry for ${name}: ${pkg.resolved}`);
    }

    // 检查 integrity
    if (!pkg.integrity) {
      issues.push(`Missing integrity for ${name}`);
    }
  }

  return issues;
}
```

## 4. 依赖混淆防护

```javascript
// 防止内部包名被外部恶意注册
// package.json
{
  "dependencies": {
    "@mycompany/utils": "^1.0.0"  // 使用 scope
  }
}

// .npmrc
@mycompany:registry=https://npm.mycompany.com
registry=https://registry.npmjs.org

// 防止 typosquatting
// 使用 lockfile-lint 验证
// npx lockfile-lint --path package-lock.json --type npm \
//   --allowed-hosts npm mycompany-npm \
//   --validate-https
```

## 5. SBOM（软件物料清单）

```bash
# 生成 SBOM
cyclonedx-npm --output-file sbom.json

# 或
syft dir:. -o cyclonedx-json > sbom.json

# 扫描 SBOM 中的漏洞
grype sbom:sbom.json

# CI 集成
git diff --name-only HEAD~1 | grep package-lock.json && {
  echo "Dependencies changed, updating SBOM..."
  cyclonedx-npm --output-file sbom.json
  git add sbom.json
}
```
