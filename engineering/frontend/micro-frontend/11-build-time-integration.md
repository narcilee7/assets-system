# 构建时集成

## 1. NPM 包集成

```
子应用作为 NPM 包发布：

app-a/
  src/
    App.tsx
    routes.ts
  package.json  # { "name": "@company/app-a", "main": "dist/index.js" }

主应用安装：
  npm install @company/app-a @company/app-b

主应用使用：
  import AppA from '@company/app-a';
  import AppB from '@company/app-b';

优点：构建时优化、Tree Shaking、类型安全
缺点：发布耦合、主应用需重新构建
```

## 2. Monorepo + 构建时合并

```
monorepo/
├── packages/
│   ├── shell/           # 主应用
│   ├── app-a/           # 子应用（作为包）
│   └── app-b/
└── package.json

// app-a/src/App.tsx
export default function AppA() { ... }

// shell/src/App.tsx
import AppA from '@company/app-a';
import AppB from '@company/app-b';

function Shell() {
  return (
    <Router>
      <Route path="/app-a/*" element={<AppA />} />
      <Route path="/app-b/*" element={<AppB />} />
    </Router>
  );
}
```

## 3. 构建时 vs 运行时

| 维度 | 构建时集成 | 运行时集成 |
|------|-----------|-----------|
| 部署耦合 | 主应用需重新构建 | 完全独立 |
| Bundle 优化 | Tree Shaking、压缩 | 各应用独立打包 |
| 类型安全 | 完全支持 | 需额外约定 |
| 发布速度 | 慢（需等主应用构建） | 快（独立发布） |
| 运行时开销 | 无 | 有（加载器、沙箱） |
| 回滚 | 需回滚主应用 | 独立回滚 |
| 适用 | 紧密耦合、频繁交互 | 独立模块、多团队 |

## 4. 渐进式演进

```
阶段 1：构建时集成（Monorepo + NPM 包）
   │
   ▼ 需要独立部署
阶段 2：Module Federation（同构建工具）
   │
   ▼ 需要异构技术栈
阶段 3：qiankun / single-spa（运行时集成）
   │
   ▼ 需要最强隔离
阶段 4：iframe（完全隔离）
```
