# SemVer

## 1. 版本号格式

```
MAJOR.MINOR.PATCH
  │      │      │
  │      │      └─ 补丁：bug 修复，向下兼容
  │      └─ 次要：新功能，向下兼容
  └─ 主要：breaking change

示例：
  1.2.3 → 1.2.4 (patch: 修复 bug)
  1.2.3 → 1.3.0 (minor: 新增功能)
  1.2.3 → 2.0.0 (major: 破坏性变更)
```

## 2. Breaking Change 定义

```markdown
什么算 breaking change？
├─ 删除公开的 API
├─ 修改公开的 API 行为
├─ 修改函数返回值格式
├─ 修改错误类型/消息（如果有用户依赖）
├─ 提升最低 Node.js 版本
├─ 修改默认配置值
└─ 修改 peer dependency 范围

什么不算 breaking change？
├─ 新增 API
├─ 修复 bug（即使有人依赖 bug 行为）
├─ 内部重构
└─ 性能优化
```

## 3. 预发布版本

```
1.0.0-alpha.1   ← 内部测试
1.0.0-beta.2    ← 公开测试
1.0.0-rc.3      ← 发布候选
1.0.0           ← 正式版

npm install package@alpha
npm install package@^1.0.0-alpha  ← 包含预发布
```

## 4. npm dist-tag

```bash
npm publish --tag beta        # 发布到 beta tag
npm publish --tag canary      # 发布到 canary tag

npm install package@latest    # 默认安装 latest
npm install package@beta      # 安装 beta 版本
npm dist-tag add package@1.2.3 latest   # 手动设置 tag
```
