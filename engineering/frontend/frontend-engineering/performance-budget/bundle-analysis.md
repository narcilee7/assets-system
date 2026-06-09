# Bundle 分析

## 1. 分析工具

```bash
# webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/stats.json

# rollup-plugin-visualizer
npm install --save-dev rollup-plugin-visualizer
# 构建后生成 stats.html

# vite-bundle-visualizer
npx vite-bundle-visualizer

# @next/bundle-analyzer
npm install --save-dev @next/bundle-analyzer
ANALYZE=true npm run build
```

## 2. 拆包策略

```javascript
// webpack
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      // 框架核心库
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        name: 'react',
        priority: 20,
      },
      // 其他第三方库
      vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
        reuseExistingChunk: true,
      },
      // 共享代码
      common: {
        minChunks: 2,
        name: 'common',
        priority: 5,
      },
    },
  },
}

// Vite/Rollup
manualChunks: {
  react: ['react', 'react-dom'],
  router: ['react-router-dom'],
}
```

## 3. 代码分割模式

```typescript
// 路由级分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// 组件级分割（大组件）
const Chart = lazy(() => import('./components/Chart'));

// 预加载
const About = lazy(() => import(
  /* webpackPrefetch: true */
  './pages/About'
));
```
