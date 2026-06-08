# 公共依赖

## 1. 问题：依赖重复加载

```
子应用 A：react@18 + react-dom@18  (40KB + 120KB)
子应用 B：react@18 + react-dom@18  (40KB + 120KB)
子应用 C：react@17 + react-dom@17  (35KB + 110KB)

问题：
1. React 被加载 3 次
2. 版本不一致（C 用 v17）
3. Bundle 体积膨胀
```

## 2. 方案对比

| 方案 | 隔离性 | 复杂度 | 适用 |
|------|--------|--------|------|
| 每个子应用独立打包 | 强 | 低 | 完全独立 |
| externals + CDN | 弱 | 低 | 简单场景 |
| Module Federation | 中 | 中 | 同 Webpack 5 |
| import-map | 中 | 低 | 原生 ESM |

## 3. Module Federation 共享

```javascript
// 主应用 webpack.config.js
const { ModuleFederationPlugin } = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        app_a: 'app_a@http://localhost:3001/remoteEntry.js',
        app_b: 'app_b@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        react: {
          singleton: true,      // 单例：只加载一个实例
          requiredVersion: '^18.0.0',
          eager: true,          // 主应用立即加载
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0',
        },
      },
    }),
  ],
};

// 子应用 A webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'app_a',
      filename: 'remoteEntry.js',
      exposes: {
        './Dashboard': './src/Dashboard',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};
```

## 4. qiankun 公共依赖

```javascript
// 方式 1：externals + CDN
// 子应用 webpack.config.js
module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
};

// 主应用 HTML 中加载 CDN
<script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>

// 方式 2：import-map（现代方案）
<script type="importmap">
{
  "imports": {
    "react": "https://cdn.example.com/react@18.2.0/index.js",
    "react-dom": "https://cdn.example.com/react-dom@18.2.0/index.js"
  }
}
</script>
```

## 5. 版本冲突处理

```javascript
// Module Federation 自动处理版本冲突
// 如果子应用 A 需要 react@18.1，子应用 B 需要 react@18.2
// 加载范围满足时共享，不满足时各自加载

shared: {
  react: {
    singleton: true,
    strictVersion: false,   // 允许版本不匹配时降级
    requiredVersion: '^18.0.0',
  },
}
```
