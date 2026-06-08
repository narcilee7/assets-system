# Vite

## 1. 核心原理

```
开发阶段：Native ESM（无需打包）
  浏览器直接请求裸模块 → Vite 预构建依赖 → 返回转换后的模块

生产阶段：Rollup 打包
  使用 Rollup 进行 tree-shaking、代码分割、压缩
```

```
开发时请求流程：
  浏览器请求 /src/main.ts
         │
         ▼
  Vite Dev Server
    ├─ 解析 import 路径
    ├─ 对 TS/Vue/React 文件进行即时编译（esbuild）
    ├─ 对裸导入（lodash）进行预构建缓存
    └─ 返回 ESM 模块 + HMR 边界信息
```

## 2. 预构建（Dependency Pre-bundling）

```javascript
// vite.config.js
export default defineConfig({
  optimizeDeps: {
    entries: ['./src/main.ts'],           // 扫描入口
    include: ['lodash-es', 'vue'],        // 强制预构建
    exclude: ['your-local-package'],       // 排除
    force: false,                          // 强制重新预构建
  },
});

// 预构建做了什么？
// 1. 将 CJS/UMD 转换为 ESM
// 2. 合并多个子模块（lodash-es 的 600+ 模块 → 单个文件）
// 3. 缓存到 node_modules/.vite/deps/
```

## 3. HMR（热更新）

```javascript
// Vite 的 HMR 基于原生 ESM
// 1. 模块变化 → 服务端通过 WebSocket 通知客户端
// 2. 客户端只重新加载变化的模块（边界）
// 3. 框架通过 accept 回调更新 DOM（不刷新页面）

// React/Vue 框架自动处理 HMR
// 自定义 HMR 边界
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // 模块更新后的处理
    console.log('Module updated:', newModule);
  });

  import.meta.hot.dispose(() => {
    // 清理旧模块的副作用
    cleanup();
  });
}
```

## 4. 插件系统

```javascript
// Vite 插件兼容 Rollup 插件 + Vite 特有钩子
const myPlugin = () => ({
  name: 'my-plugin',

  // Vite 特有：配置解析后
  configResolved(config) {
    console.log('Resolved config:', config);
  },

  // Vite 特有：转换 HTML
  transformIndexHtml(html) {
    return html.replace('<title>', '<title>My App - ');
  },

  // Rollup 兼容：转换代码
  transform(code, id) {
    if (id.endsWith('.special')) {
      return { code: transformSpecial(code), map: null };
    }
  },

  // Rollup 兼容：解析模块
  resolveId(source) {
    if (source === 'virtual-module') {
      return source;  // 标记为虚拟模块
    }
  },

  // Rollup 兼容：加载虚拟模块内容
  load(id) {
    if (id === 'virtual-module') {
      return 'export const msg = "Hello from virtual module"';
    }
  },
});
```
