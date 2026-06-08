# Supply Chain Security Checklist

Node.js 生态的依赖链是最长的软件供应链之一。攻击面包括恶意包、依赖混淆、泄露的 secret 等。

## Checklist

### 1. 依赖管理

- [ ] 使用 `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` 并提交到版本控制。
- [ ] 定期运行 `npm audit` 或 `pnpm audit`，并自动化到 CI。
- [ ] 使用 `npm ls` 或 `pnpm why <pkg>` 理解依赖树。
- [ ] 限制内部包发布到私有 registry，防止依赖混淆。

### 2. 安装时防护

- [ ] 使用 `--ignore-scripts` 安装未知来源的包，审查 `postinstall` 脚本。
- [ ] 使用 `npm_config_ignore_scripts=true` 作为全局默认（CI 除外）。
- [ ] 使用 `lockfile-lint` 校验 lockfile 的完整性和来源。

### 3. Secret 防护

- [ ] 使用 `git-secrets` 或 `truffleHog` 扫描历史提交。
- [ ] `.npmrc` 中绝不写入 `_authToken`，改用 `npm login` 或环境变量。
- [ ] 使用 `detect-secrets` 做预提交钩子。

### 4. 运行时防护

- [ ] 使用 `SSRI` 校验下载的 native addon 二进制哈希。
- [ ] 监控异常网络连接（如 unexpected DNS 请求）。
- [ ] 使用 `vm2` 的替代方案（如 `isolated-vm`）执行不可信代码。

### 5. 发布安全

- [ ] 启用 npm 2FA。
- [ ] 使用 provenance（`npm publish --provenance`）增强发布可信度。
- [ ] 使用 `package-name` 抢占内部包名，防止依赖混淆。

## 工具推荐

| 工具 | 用途 |
| --- | --- |
| `npm audit` / `snyk` | 已知漏洞扫描 |
| `socket.dev` | 包行为分析 |
| `lockfile-lint` | lockfile 完整性 |
| `truffleHog` | Secret 泄露扫描 |
| `sigstore` | 供应链签名验证 |
