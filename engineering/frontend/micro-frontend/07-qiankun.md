# qiankun

## 1. 核心原理

qiankun = single-spa + HTML Entry + 沙箱 + 样式隔离

```
single-spa:   微前端生命周期管理（bootstrap/mount/unmount）
HTML Entry:   通过 URL 加载子应用完整 HTML
沙箱:         JS 隔离（Proxy Sandbox / Snapshot Sandbox）
样式隔离:     严格隔离（Shadow DOM）或 作用域前缀
```

## 2. 主应用配置

```javascript
// main-app/src/index.js
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  {
    name: 'react-app',
    entry: '//localhost:3001',  // HTML Entry
    container: '#subapp-container',
    activeRule: '/react',
    props: { user: { name: 'John' } },
  },
  {
    name: 'vue-app',
    entry: '//localhost:3002',
    container: '#subapp-container',
    activeRule: '/vue',
  },
], {
  // 生命周期钩子
  beforeLoad: (app) => console.log('before load', app.name),
  beforeMount: [(app) => console.log('before mount', app.name)],
  afterUnmount: [(app) => console.log('after unmount', app.name)],
});

start({
  prefetch: 'all',           // 预加载所有子应用
  sandbox: {
    strictStyleIsolation: false,      // Shadow DOM（部分 UI 库不兼容）
    experimentalStyleIsolation: true, // 作用域前缀（推荐）
  },
});
```

## 3. 子应用配置（React）

```javascript
// react-app/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

let root = null;

function render(props = {}) {
  const { container } = props;
  root = ReactDOM.createRoot(
    container ? container.querySelector('#root') : document.getElementById('root')
  );
  root.render(<App {...props} />);
}

// 独立运行时
if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

// qiankun 生命周期
export async function bootstrap() {
  console.log('react app bootstraped');
}

export async function mount(props) {
  console.log('react app mount', props);
  render(props);
}

export async function unmount(props) {
  console.log('react app unmount');
  root.unmount();
  root = null;
}

export async function update(props) {
  console.log('react app update', props);
}
```

## 4. 子应用配置（Vue 3）

```javascript
// vue-app/src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

let app = null;

function render(props = {}) {
  const { container } = props;
  app = createApp(App);
  app.use(router);
  app.mount(container ? container.querySelector('#app') : '#app');
}

if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

export async function bootstrap() {}

export async function mount(props) {
  render(props);
}

export async function unmount() {
  app.unmount();
  app = null;
}
```

## 5. 公共依赖提取

```javascript
// 主应用加载公共依赖
import { start } from 'qiankun';

// 在 start 前加载共享库
Promise.all([
  import('https://cdn.example.com/react@18.js'),
  import('https://cdn.example.com/react-dom@18.js'),
]).then(() => {
  start();
});

// 子应用配置 externals
// webpack.config.js
module.exports = {
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
};
```
