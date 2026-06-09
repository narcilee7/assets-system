# 变更日志

## 1. Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>

类型：
  feat:     新功能
  fix:      修复
  docs:     文档
  style:    代码风格（不影响功能）
  refactor: 重构
  perf:     性能优化
  test:     测试
  chore:    构建/工具
  ci:       CI 配置
  BREAKING CHANGE: 破坏性变更（footer）
```

```bash
# 示例
feat(auth): add OAuth2 login support

fix(api): handle timeout error

feat(button): redesign primary button

BREAKING CHANGE: remove deprecated `onClick` prop
```

## 2. 自动生成

```bash
# conventional-changelog
npx conventional-changelog -p angular -i CHANGELOG.md -s

# 或集成到 release 流程
# changeset 自动生成
# release-it 自动生成
```

```markdown
<!-- CHANGELOG.md -->
## [1.2.0](https://github.com/...) (2024-01-15)

### Features
* **auth:** add OAuth2 login support ([abc123](...))

### Bug Fixes
* **api:** handle timeout error ([def456](...))

### BREAKING CHANGES
* remove deprecated `onClick` prop
```
