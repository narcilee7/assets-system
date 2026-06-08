# Module Federation

## 1. 核心概念

```
Module Federation = 运行时加载远程模块

Host（主应用）          Remote（子应用/模块）
   │                       │
   │  import('remote/App') │
   │ ─────────────────────>│
   │                       │ 暴露模块
   │ <─────────────────────│  remoteEntry.js
   │                       │
   │ 共享依赖自动去重       │
```

## 2. 主应用（Host）

```javascript
// shell/webpack.config.js
const { ModuleFederationPlugin } = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        // 远程模块名: '全局变量名@远程入口URL'
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
        settings: 'settings@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};

// shell/src/App.js
import React, { lazy, Suspense } from 'react';

// 动态加载远程模块
const DashboardApp = lazy(() => import('dashboard/App'));
const SettingsApp = lazy(() => import('settings/App'));

function App() {
  return (
    <div>
      <h1>Shell App</h1>
      <Suspense fallback="Loading...">
        <DashboardApp />
      </Suspense>
    </div>
  );
}
```

## 3. 远程应用（Remote）

```javascript
// dashboard/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'dashboard',
      filename: 'remoteEntry.js',  // 远程入口文件
      exposes: {
        // 暴露的模块
        './App': './src/App',
        './Widget': './src/Widget',
        './utils': './src/utils',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};
```

## 4. 运行时动态加载

```javascript
// 运行时动态添加 remote
async function loadRemoteApp(name, url) {
  await __webpack_init_sharing__('default');

  const container = window[name];  // 远程应用挂载到 window
  await container.init(__webpack_share_scopes__.default);

  const factory = await container.get('./App');
  const Module = factory();
  return Module;
}

// 使用
const DashboardApp = await loadRemoteApp('dashboard', 'http://localhost:3001/remoteEntry.js');
```

## 5. MF vs qiankun

| 维度 | Module Federation | qiankun |
|------|-------------------|---------|
| 集成粒度 | 模块级 | 应用级 |
| 隔离性 | 弱（共享上下文） | 强（沙箱隔离） |
| 技术栈 | 需 Webpack/Rspack | 任意 |
| 路由 | 组件级嵌入 | 页面级切换 |
| 部署 | 独立部署 | 独立部署 |
| 共享依赖 | 原生支持 | 需额外配置 |
| 适用 | 同构建工具、紧密集成 | 异构技术栈、强隔离 |
