# Nx

## 1. 核心概念

Nx = 智能构建系统 + monorepo 工具，通过项目图（Project Graph）分析依赖关系。

```
Nx 项目图：
  lib-a ──> lib-b ──> app-web
      │
      └────> app-admin

Nx 自动分析 import 语句构建此图，只构建 affected 的部分
```

## 2. 配置

```json
// nx.json
{
  "extends": "nx/presets/npm.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"]
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"]
    }
  },
  "affected": {
    "defaultBase": "main"
  },
  "plugins": ["@nx/vite", "@nx/react"]
}
```

```bash
# 命令
nx build app-web           # 构建 app-web
nx test lib-a              # 测试 lib-a
nx run-many -t build -p app-web app-admin   # 多项目
nx affected -t build       # 只构建变更的包
nx graph                   # 可视化项目图
```

## 3. 计算缓存

```bash
# 本地缓存
nx build app-web  # 第一次构建
nx build app-web  # 第二次：瞬间完成（缓存命中）

# 远程缓存（Nx Cloud）
nx connect-to-nx-cloud
nx build app-web --skip-nx-cache  # 跳过缓存
```

## 4. Nx vs Turborepo

| 特性 | Nx | Turborepo |
|------|-----|-----------|
| 项目图 | 自动生成 + 可视化 | 手动配置 |
| 插件生态 | 丰富（React、Vue、Node、Nest 等） | 较少 |
| 代码生成 | 强大（schematics） | 基本 |
| 学习曲线 | 较陡 | 平缓 |
| 适用 | 大型、复杂项目 | 中小型、简单项目 |
