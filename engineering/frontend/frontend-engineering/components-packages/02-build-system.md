# 构建系统

## 1. 输出格式

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,    // 生成 types 入口
      rollupTypes: true,         // 合并 .d.ts
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MyUI',
      formats: ['es', 'cjs', 'umd'],  // 三种格式
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      // 外部依赖（不打包到产物中）
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
```

## 2. 产物结构

```
dist/
├── index.es.js          # ESM（现代浏览器、Vite、Webpack 5）
├── index.cjs.js         # CJS（Node.js、旧版 Webpack）
├── index.umd.js         # UMD（浏览器 script 标签）
├── index.d.ts           # 类型声明入口
├── components/
│   ├── button/
│   │   ├── index.js     # ESM
│   │   ├── index.cjs    # CJS
│   │   └── index.d.ts   # 类型
│   └── input/
│       └── ...
└── style/
    ├── index.css        # 全量样式
    └── button.css       # 按需样式
```

## 3. Tree Shaking

```json
// package.json
{
  "name": "@my-ui/components",
  "main": "dist/index.cjs.js",
  "module": "dist/index.es.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "sideEffects": [
    "*.css",
    "*.less",
    "*.scss"
  ],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.es.js",
      "require": "./dist/index.cjs.js"
    },
    "./button": {
      "types": "./dist/components/button/index.d.ts",
      "import": "./dist/components/button/index.js",
      "require": "./dist/components/button/index.cjs"
    },
    "./style.css": "./dist/style/index.css"
  }
}
```

## 4. 按需加载（Babel Plugin）

```javascript
// babel-plugin-import 配置
// .babelrc
{
  "plugins": [
    ["import", {
      "libraryName": "@my-ui/components",
      "libraryDirectory": "dist/components",
      "style": "css"  // 自动引入对应 CSS
    }]
  ]
}

// 转换前
import { Button, Input } from '@my-ui/components';

// 转换后
import Button from '@my-ui/components/dist/components/button';
import Input from '@my-ui/components/dist/components/input';
import '@my-ui/components/dist/components/button/style.css';
import '@my-ui/components/dist/components/input/style.css';
```

## 5. CSS 提取

```javascript
// vite.config.ts（CSS 提取配置）
import { libInjectCss } from 'vite-plugin-lib-inject-css';

export default defineConfig({
  plugins: [
    react(),
    dts(),
    libInjectCss(),  // 每个组件单独提取 CSS
  ],
});

// 或使用 rollup-plugin-postcss
import postcss from 'rollup-plugin-postcss';

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: [
        postcss({
          extract: true,        // 提取到单独 CSS 文件
          modules: true,        // CSS Modules
        }),
      ],
    },
  },
});
```
