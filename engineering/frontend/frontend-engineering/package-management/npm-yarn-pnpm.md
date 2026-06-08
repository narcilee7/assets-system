# npm / Yarn / pnpm

## 1. 三代包管理器演进

```
npm v1-2          npm v3+           Yarn 1           Yarn 2+ (PnP)     pnpm
   │               │               │                │                │
   │ 嵌套 node_modules │ 扁平化         │ lockfile       │ Plug'n'Play    │ 内容寻址
   │               │               │                │                │ + 硬链接
   ▼               ▼               ▼                ▼                ▼
深度 100+          幽灵依赖           确定性安装        无 node_modules   单实例存储
                  依赖膨胀
```

## 2. npm

```bash
# package-lock.json 确保确定性安装
npm ci              # 严格按 lockfile 安装（CI 推荐）
npm install         # 可能更新 lockfile

# workspaces (v7+)
{
  "workspaces": ["packages/*"]
}

npm workspaces run build    # 所有 workspace 执行 build
npm workspaces run test -w pkg-a   # 只运行 pkg-a
```

## 3. Yarn

```bash
# Yarn 1
yarn install --frozen-lockfile   # CI 推荐

# Yarn Berry (2+) - Plug'n'Play
# .pnp.cjs 替代 node_modules
# 严格依赖检查（无幽灵依赖）
# Zero-Install：依赖提交到 .yarn/cache

yarn install
yarn build
yarn workspaces foreach -pt run build   # 拓扑排序并行构建
```

## 4. pnpm

```bash
# 内容寻址存储 + 硬链接
# 全局 store: ~/.pnpm-store
# 项目 node_modules: 硬链接到 store

pnpm install
pnpm add lodash
pnpm add -D typescript

# workspaces
pnpm -r run build          # 递归所有 workspace
pnpm --filter pkg-a build  # 只构建 pkg-a
pnpm --filter "...pkg-b" test   # pkg-b 及依赖它的包

# 依赖分析
pnpm why lodash            # 为什么安装了 lodash
pnpm list --depth=10       # 依赖树
```

**pnpm 的 node_modules 结构**：
```
node_modules/
├── .pnpm/                  # 虚拟存储（所有依赖的真实位置）
│   ├── lodash@4.17.21/
│   └── react@18.2.0/
├── lodash -> .pnpm/lodash@4.17.21/node_modules/lodash   # 软链接
└── react -> .pnpm/react@18.2.0/node_modules/react
```

## 5. 对比

| 特性 | npm | Yarn 1 | Yarn Berry | pnpm |
|------|-----|--------|------------|------|
| 安装速度 | 中 | 中 | 快 | 极快 |
| 磁盘占用 | 大 | 大 | 中 | 小 |
| 幽灵依赖 | 有 | 有 | 无 | 无 |
| 严格依赖 | 否 | 否 | 是 | 是 |
| workspaces | ✅ | ✅ | ✅ | ✅ |
| lockfile | package-lock | yarn.lock | yarn.lock | pnpm-lock |
