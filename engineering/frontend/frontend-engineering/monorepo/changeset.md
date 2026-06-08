# Changesets

## 1. 工作流

```
开发者修改代码
       │
       ▼
  pnpm changeset    # 选择包、指定版本变更类型
       │
       ▼
  生成 .changeset/*.md 文件
       │
       ▼
  PR 合并到 main
       │
       ▼
  GitHub Action：
    读取 changeset → bump version → 生成 changelog → 发布到 npm
```

## 2. 使用

```bash
# 1. 初始化
npx changeset init

# 2. 添加 changeset（每次修改后）
pnpm changeset
# 交互式选择：
# - 哪些包有变更？
# - patch / minor / major？
# - 变更描述？

# 3. 版本提升 + 生成 changelog
pnpm changeset version

# 4. 发布
pnpm changeset publish
```

```markdown
<!-- .changeset/hungry-apes-visit.md -->
---
"@my/ui": minor
"@my/utils": patch
---

Added new Button variant and fixed tooltip positioning
```

## 3. CI 集成

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```
