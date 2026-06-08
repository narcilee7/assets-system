# 金丝雀发布

## 1. 自动 Canary 流程

```bash
# 每次 PR 合并后自动发布 canary 版本

# 1. 生成 canary 版本号
# base: 1.2.3 → canary: 1.2.4-canary.abc123.0

# 2. CI 自动发布
# GitHub Action：
#   on: push to main
#   job: publish-canary
```

```yaml
# .github/workflows/canary.yml
name: Canary Release
on:
  push:
    branches: [main]
jobs:
  canary:
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm build
      - name: Version
        run: |
          SHORT_SHA=$(git rev-parse --short HEAD)
          pnpm version prerelease --preid canary.$SHORT_SHA --no-git-tag-version
      - name: Publish
        run: pnpm publish --tag canary --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 2. Canary 验证

```bash
# 用户安装 canary 版本测试
npm install package@canary

# 验证通过后，正式发布
npm dist-tag add package@1.2.4 latest
```
