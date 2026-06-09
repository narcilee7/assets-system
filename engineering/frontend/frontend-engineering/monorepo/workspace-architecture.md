# Monorepo 架构设计

## 1. 包划分原则

```
按职责划分：
├─ apps/           # 应用（可部署的单元）
│   ├─ web/        # 主站
│   ├─ admin/      # 管理后台
│   └─ mobile/     # H5
│
├─ packages/       # 共享库
│   ├─ ui/         # UI 组件库
│   ├─ hooks/      # 共享 hooks
│   ├─ utils/      # 工具函数
│   ├─ api/        # API 客户端 + 类型
│   ├─ config/     # 共享配置（eslint, tsconfig, tailwind）
│   └─ types/      # 共享 TypeScript 类型
│
└─ tooling/        # 内部工具
    ├─ eslint-config/
    ├─ tsconfig/
    └─ plop-templates/
```

## 2. 依赖方向

```
单向依赖原则：

  apps ──> packages ──> tooling
    │         │
    │         └─ 不能反向依赖 apps
    │
    └─ packages 之间可以依赖，但不能循环

循环依赖检测：
  npx madge --circular packages/
```

## 3. 发布策略

| 策略 | 说明 | 适用 |
|------|------|------|
| **固定模式** | 所有包同时发布，版本号一致 | 紧密耦合的库 |
| **独立模式** | 每个包独立版本 | 松耦合的 monorepo |
| **Canary** | 每次 PR 发布预览版本 | 快速验证 |

## 4. 配置共享

```json
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}

// apps/web/tsconfig.json
{
  "extends": "@my/tsconfig/base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```
