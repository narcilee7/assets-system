# 下一代编译器

## 1. esbuild

```bash
# 极快的 JS/TS 打包器（Go 编写）
esbuild src/index.ts --bundle --outfile=dist/index.js --minify

# 性能对比（10k 模块项目）
# Webpack: ~60s
# Vite (esbuild 转换): ~5s
# esbuild: ~0.5s
```

```javascript
// JavaScript API
const esbuild = require('esbuild');

await esbuild.build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  outfile: './dist/index.js',
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  format: 'esm',
  splitting: true,       // 代码分割（仅 ESM）
  treeShaking: true,
  metafile: true,        // 输出元数据用于分析
});
```

**esbuild 的限制**：
- 不支持 TypeScript 类型检查（只做转译）
- 不支持自定义 AST 转换
- 产物不如 Webpack 精细优化

## 2. SWC

```bash
# Rust 编写的 JS/TS 编译器（Babel 替代）
# 核心：parser + transform + codegen

# 使用 swc-cli
npx swc src -d dist

# 使用 @swc/core
const swc = require('@swc/core');
const result = await swc.transform(code, {
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    transform: { react: { runtime: 'automatic' } },
    target: 'es2020',
  },
  module: { type: 'es6' },
});
```

**SWC 插件**：
```javascript
// 自定义 SWC 插件（Rust 或 JS）
// SWC 的插件基于 WebAssembly
```

## 3. Turbopack

```
Turbopack = Webpack 的 Rust 继任者（Next.js 官方）

特性：
- Incremental Computation（增量计算图）
- 模块级缓存
- HMR 比 Webpack 快 700x，比 Vite 快 10x（官方数据）
- 目前仅支持 Next.js
```

## 4. 编译器选型

| 场景 | 推荐 |
|------|------|
| 纯转译（CI/CD） | esbuild / SWC |
| Vite 项目 | esbuild（开发）+ Rollup（生产） |
| Next.js | Turbopack（实验）/ Webpack |
| 存量 Webpack 项目 | Rspack |
| 自定义 Babel 插件 | SWC（逐步迁移） |
