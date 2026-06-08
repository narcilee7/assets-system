# 供应链安全

## 1. npm 生态风险

```
攻击面：
├─ 恶意包（typosquatting：lodash 拼成 lodash）
├─ 被入侵的维护者账号
├─ 依赖的依赖（transitive dependencies）
├─ 过时的漏洞版本
└─ lockfile 篡改
```

## 2. 防护措施

### 锁定依赖版本

```bash
# package-lock.json / yarn.lock / pnpm-lock.yaml
# 必须提交到版本控制！

# 审计已知漏洞
npm audit
npm audit fix

# 更严格的工具
npx audit-ci --moderate
npx better-npm-audit audit
```

### 依赖扫描工具

```bash
# Snyk
npx snyk test
npx snyk monitor

# Dependabot（GitHub 内置）
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"

# Renovate（更灵活）
```

### 私有 registry + 代理

```bash
# .npmrc
registry=https://your-private-registry.com
# 或配置代理缓存
@your-company:registry=https://private.npmjs.com
```

## 3. SBOM（Software Bill of Materials）

```bash
# 生成 SBOM
npm sbom --format=spdx-json > sbom.json

# 验证 SBOM
npx sbom-check sbom.json

# 用途：
# 1. 安全审计时快速定位受影响组件
# 2. 合规要求（如美国政府要求关键软件提供 SBOM）
# 3. 漏洞响应时快速评估影响范围
```

## 4. 构建时安全

```javascript
// webpack 配置：防止源码泄露
module.exports = {
  devtool: process.env.NODE_ENV === 'production'
    ? false           // 生产环境不生成 source map
    : 'source-map',
};

// 环境变量校验（防止敏感信息泄露）
const requiredEnv = ['API_URL'];
const optionalEnv = ['ANALYTICS_ID'];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}`);
  }
}

// 防止将 .env 文件打包
// .gitignore
.env
.env.local
.env.*.local
```

## 5. 子资源完整性（SRI）

```html
<!-- 确保 CDN 资源未被篡改 -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous"
></script>

<!-- 生成 integrity 值 -->
# cat lib.js | openssl dgst -sha384 -binary | openssl base64 -A
```
