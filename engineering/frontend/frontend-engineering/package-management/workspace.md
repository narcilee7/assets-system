# Workspace

## 1. npm Workspaces

```json
// package.json
{
  "name": "my-monorepo",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces"
  }
}
```

```bash
# 在根目录安装共享依赖
npm install lodash -w      # 安装到根
npm install react -w app-a # 安装到 app-a
```

## 2. pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'
```

```bash
# 过滤命令
pnpm --filter "@scope/*" build
pnpm --filter "...pkg-a" test     # pkg-a 及依赖
pnpm --filter "pkg-a..." build    # pkg-a 及被依赖
pnpm --filter "{packages}[master]" test   # 变更的包
```

## 3. 目录结构

```
my-monorepo/
├── package.json              # 根 package.json
├── pnpm-workspace.yaml       # workspace 配置
├── turbo.json               # Turborepo 配置
├── packages/
│   ├── ui/                  # 共享 UI 组件
│   │   ├── package.json     # { "name": "@my/ui" }
│   │   └── src/
│   ├── utils/               # 工具函数
│   └── config/              # 共享配置（eslint, tsconfig）
└── apps/
    ├── web/                 # 主站
    │   └── package.json     # { "dependencies": { "@my/ui": "workspace:*" } }
    └── admin/               # 管理后台
```

## 4. 内部依赖

```json
{
  "dependencies": {
    "@my/ui": "workspace:*",      // pnpm：始终使用 workspace 版本
    "@my/utils": "workspace:^"    // 遵循 semver
  }
}
```
