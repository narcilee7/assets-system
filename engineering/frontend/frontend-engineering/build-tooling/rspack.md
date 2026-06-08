# Rspack

## 1. 定位

Rspack = Rust 编写的 Webpack，追求 **Webpack 兼容 + Rust 性能**。

```
Webpack (JS)          Rspack (Rust)
    │                     │
    │ 10k+ 模块            │ 10k+ 模块
    │ 冷启动 ~60s          │ 冷启动 ~5s
    │ HMR ~3s              │ HMR ~0.3s
    │                      │
    └───── 相同配置 ───────┘
```

## 2. 核心特性

```javascript
// rspack.config.js（与 Webpack 兼容）
module.exports = {
  entry: './src/index.js',
  output: {
    filename: '[name].[contenthash].js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'builtin:swc-loader',  // 内置 SWC loader
          options: {
            jsc: {
              parser: { syntax: 'ecmascript', jsx: true },
              transform: { react: { runtime: 'automatic' } },
            },
          },
        },
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin(),  // 内置插件
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
};
```

## 3. 与 Webpack/Vite 对比

| 维度 | Webpack | Vite | Rspack |
|------|---------|------|--------|
| 语言 | JS | JS (Go/Rust 工具) | Rust |
| 开发模式 | 打包 | Native ESM | 打包（但快） |
| 冷启动 | 慢 | 极快 | 快 |
| HMR | 中等 | 极快 | 极快 |
| 生态 | 最大 | 大 | 兼容 Webpack |
| 配置 | 复杂 | 简单 | 兼容 Webpack |
| 适用 | 成熟项目 | 新项目 | 大型存量项目 |

## 4. 迁移路径

```bash
# 1. 安装 Rspack
npm install @rspack/core @rspack/cli

# 2. 替换 webpack 命令
# package.json
"scripts": {
  "build": "rspack build",
  "dev": "rspack serve"
}

# 3. 配置文件改名（或直接复用 webpack.config.js）
mv webpack.config.js rspack.config.js

# 4. 替换 loader
# babel-loader → builtin:swc-loader
# ts-loader → builtin:swc-loader
```
