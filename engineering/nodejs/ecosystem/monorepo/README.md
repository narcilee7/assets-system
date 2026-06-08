# Monorepo with pnpm + Turborepo

Monorepo 是 Node.js 中大型项目的标准组织方式。pnpm workspaces + Turborepo 是当前最佳实践。

## 目录结构

```
monorepo/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── api/              # NestJS / Express API
│   └── web/              # Next.js 前端
└── packages/
    ├── shared/           # 共享工具、类型
    ├── ui/               # 共享组件库
    └── config/           # 共享 ESLint / TS 配置
```

## 配置

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Root package.json

```json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "turbo run build && changeset publish"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "@changesets/cli": "^2.27.0"
  }
}
```

### 共享包 package.json

```json
// packages/shared/package.json
{
  "name": "@myorg/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch"
  }
}
```

### 应用引用共享包

```json
// apps/api/package.json
{
  "dependencies": {
    "@myorg/shared": "workspace:*"
  }
}
```

## Changesets 版本管理

```bash
# 创建 changeset
pnpm changeset

# 版本 bump
pnpm version-packages

# 发布
pnpm release
```

## 最佳实践

- 使用 `workspace:*` 引用内部包，确保版本一致。
- `turbo.json` 中 `dependsOn: ["^build"]` 确保依赖包先构建。
- 共享配置（eslint、tsconfig、tailwind）放入 `packages/config`。
- CI 中使用 `turbo run test --filter=[origin/main...HEAD]` 只测试变更包。
