# 构建工具全景对比

## 1. 速度对比

| 工具 | 冷启动 | HMR | 生产构建 | 10k 模块 |
|------|--------|-----|----------|----------|
| Webpack 5 | 8-15s | 1-3s | 30-60s | 60s+ |
| Vite | 0.3s | 50ms | 10-20s | 15s |
| Rspack | 2-5s | 0.3s | 8-15s | 10s |
| esbuild | 0.1s | - | 0.5-2s | 2s |
| Turbopack | 1s | 10ms | - | - |

## 2. 功能矩阵

| 功能 | Webpack | Vite | Rspack | esbuild |
|------|---------|------|--------|---------|
| ESM 输出 | ✅ | ✅ | ✅ | ✅ |
| CJS 输出 | ✅ | ✅ | ✅ | ✅ |
| CSS 提取 | ✅ | ✅ | ✅ | ⚠️ |
| CSS Modules | ✅ | ✅ | ✅ | ⚠️ |
| 图片处理 | ✅ | ✅ | ✅ | ⚠️ |
| HMR | ✅ | ✅ | ✅ | ❌ |
| Module Federation | ✅ | ⚠️ | ✅ | ❌ |
| SSR | ✅ | ✅ | ⚠️ | ❌ |
| Source Map | 高质量 | 高质量 | 高质量 | 中等 |
| Plugin 生态 | 最大 | 大 | 兼容 Webpack | 小 |

## 3. 选型决策

```
新项目？
  ├─ 是 → 需要 SSR / 全栈？
  │         ├─ 是 → Next.js / Nuxt（默认 Turbopack/Rspack）
  │         └─ 否 → Vite（SPA 最佳体验）
  │
  └─ 否（存量项目）→ 构建很慢？
           ├─ 是 → 配置复杂？
           │         ├─ 是 → Rspack（兼容 Webpack 配置）
           │         └─ 否 → Vite（迁移成本中）
           │
           └─ 否 → 保持 Webpack（稳定优先）

特定场景：
  - 库开发 → tsup（基于 esbuild）/ Rollup
  - CLI 工具 → esbuild（纯打包）
  - 超大型项目 → Rspack / Turbopack
```
