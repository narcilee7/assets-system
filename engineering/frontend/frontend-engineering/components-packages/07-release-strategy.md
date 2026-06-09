# Release 策略

## 1. Semantic Versioning（组件库版）

```
组件库 SemVer 规则：

MAJOR（Breaking Change）
  ├─ 移除组件或 Props
  ├─ 修改组件默认行为
  ├─ 修改主题 Token 名称
  ├─ 提升最低浏览器/Node 版本
  └─ 修改构建产物格式

MINOR（新功能）
  ├─ 新增组件
  ├─ 新增 Props（不影响现有）
  ├─ 新增主题变量
  └─ 新增图标

PATCH（Bug Fix）
  ├─ 修复样式问题
  ├─ 修复类型定义
  ├─ 修复可访问性问题
  └─ 性能优化（无行为变更）
```

## 2. Breaking Change 管理

```markdown
## 发布前检查清单

### 1. 版本评估
- [ ] 是否有 API 变更？ → MINOR 或 MAJOR
- [ ] 是否有移除？ → MAJOR
- [ ] 仅 Bug Fix？ → PATCH

### 2. 迁移指南（MAJOR 必须）
```markdown
## @my-ui/components@3.0.0 迁移指南

### Breaking Changes
- `Button` 组件移除 `type` prop，请使用 `variant`
  ```diff
  - <Button type="primary">Click</Button>
  + <Button variant="primary">Click</Button>
  ```
- `theme` 配置文件格式变更
  ```diff
  - { primaryColor: '#3b82f6' }
  + { color: { primary: '#3b82f6' } }
  ```

### 自动迁移
```bash
npx @my-ui/codemod@latest ./src
```

### 手动迁移步骤
1. 全局替换 `type=` 为 `variant=`
2. 更新 theme 配置文件
3. 检查自定义样式是否受影响
```

### 3. Codemod（自动化迁移）
```javascript
// codemods/button-type-to-variant.js
module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  root.find(j.JSXOpeningElement, { name: { name: 'Button' } })
    .find(j.JSXAttribute, { name: { name: 'type' } })
    .forEach((path) => {
      path.value.name.name = 'variant';
    });

  return root.toSource();
};
```

### 4. 兼容性层（Graceful Deprecation）
```tsx
// 新版本保留旧 API 但打印警告
function Button({ type, variant, ...props }: ButtonProps) {
  const actualVariant = variant || type;

  if (type) {
    console.warn(
      '[@my-ui/components] Button `type` prop is deprecated. Use `variant` instead.'
    );
  }

  return <button data-variant={actualVariant} {...props} />;
}
```

## 3. Canary / Beta / RC 流程

```bash
# 1. 开发阶段：自动发布 Canary
# 每次 PR 合并到 main 分支
npm version prerelease --preid canary
npm publish --tag canary
# 输出：@my-ui/components@2.5.0-canary.abc123.0

# 2. 测试阶段：发布 Beta
npm version prerelease --preid beta
npm publish --tag beta
# 输出：@my-ui/components@2.5.0-beta.1

# 3. 稳定前：发布 RC
npm version prerelease --preid rc
npm publish --tag rc
# 输出：@my-ui/components@2.5.0-rc.1

# 4. 正式发布
npm version patch|minor|major
npm publish
```

## 4. Monorepo 版本策略

```json
// Changesets 配置
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@2.3.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [
    // 固定版本：这些包永远同版本
    ["@my-ui/components", "@my-ui/theme-default"]
  ],
  "linked": [
    // 关联版本：一个变，其他也变（但版本号可能不同）
    ["@my-ui/icons", "@my-ui/locale"]
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```
