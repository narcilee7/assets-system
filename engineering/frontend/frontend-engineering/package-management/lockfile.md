# Lockfile 机制

## 1. 为什么需要 Lockfile

```
package.json: "lodash": "^4.17.0"

不同时间安装可能得到不同版本：
  今天 → lodash@4.17.21
  明天 → lodash@4.17.25（如果发布了新版本）

Lockfile 锁定确切版本，确保所有人、所有环境安装一致
```

## 2. Lockfile 结构

```yaml
# pnpm-lock.yaml（最详细）
lockfileVersion: '6.0'
settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false
dependencies:
  lodash:
    specifier: ^4.17.21
    version: 4.17.21
packages:
  /lodash@4.17.21:
    resolution: {integrity: sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg==}
    dev: false
```

## 3. 冲突解决

```bash
# lockfile 冲突时
# 方案 1：接受当前分支，重新生成
 git checkout --ours pnpm-lock.yaml
 pnpm install

# 方案 2：接受合并分支，重新生成
 git checkout --theirs pnpm-lock.yaml
 pnpm install

# 方案 3：合并后修复
# 手动解决冲突标记，然后
pnpm install --no-frozen-lockfile
```

## 4. 安全审计

```bash
# 检查 lockfile 中的漏洞
npm audit
pnpm audit
yarn npm audit

# 自动修复
npm audit fix
pnpm audit --fix

# 检查 lockfile 篡改
# 确保 lockfile 在 Git 中
# CI 中验证 lockfile 一致性
# pnpm install --frozen-lockfile
```
