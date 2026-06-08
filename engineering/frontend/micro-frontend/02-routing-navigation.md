# 路由与导航

## 1. 主应用路由（URL 分配）

```
URL 分配策略：

/app-a/*    → 子应用 A（React）
/app-b/*    → 子应用 B（Vue）
/app-c/*    → 子应用 C（Angular）
/           → 主应用首页

示例：
/app-a/dashboard     → 子应用 A 的 dashboard 页
/app-b/users/123     → 子应用 B 的用户详情页
```

```javascript
// 主应用路由配置（qiankun）
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  {
    name: 'app-a',
    entry: '//localhost:3001',
    container: '#container',
    activeRule: '/app-a',
  },
  {
    name: 'app-b',
    entry: '//localhost:3002',
    container: '#container',
    activeRule: '/app-b',
  },
]);

start();
```

## 2. 子应用路由适配

```javascript
// 子应用 A（React + React Router）
// 需要配置 basename
import { BrowserRouter } from 'react-router-dom';

function App(props) {
  return (
    <BrowserRouter basename={props.base || '/app-a'}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

// qiankun 生命周期导出
export async function bootstrap() {
  console.log('app-a bootstrap');
}

export async function mount(props) {
  ReactDOM.render(<App {...props} />, props.container);
}

export async function unmount(props) {
  ReactDOM.unmountComponentAtNode(props.container);
}
```

## 3. 跨应用导航

```javascript
// 方式 1：URL 跳转（推荐）
// 主应用跳转到子应用
history.push('/app-b/users/123');

// 方式 2：qiankun 的 actions
import { actions } from 'qiankun';

// 主应用设置全局状态
actions.setGlobalState({ user: { name: 'John' } });

// 子应用监听
export async function mount(props) {
  props.onGlobalStateChange((state, prev) => {
    console.log('Global state changed:', state);
  });
}

// 方式 3：Event Bus（自定义）
class EventBus {
  constructor() {
    this.events = {};
  }
  on(event, fn) {
    (this.events[event] ||= []).push(fn);
  }
  emit(event, data) {
    (this.events[event] || []).forEach((fn) => fn(data));
  }
}

window.microEventBus = new EventBus();

// 应用 A 发送
window.microEventBus.emit('navigate', { to: '/app-b/users/123' });

// 主应用监听并处理路由
window.microEventBus.on('navigate', ({ to }) => {
  history.push(to);
});
```

## 4. 浏览器历史管理

```javascript
// 问题：子应用调用 history.pushState 会污染主应用历史

// 解决方案 1：劫持子应用的 history
const originalPushState = window.history.pushState;
window.history.pushState = function (...args) {
  // 在 qiankun 中，自动处理
  return originalPushState.apply(this, args);
};

// 解决方案 2：子应用使用内存路由（不操作浏览器历史）
// 子应用内部使用 HashRouter 或 MemoryRouter
import { MemoryRouter } from 'react-router-dom';

function App() {
  return (
    <MemoryRouter>
      <Routes>...</Routes>
    </MemoryRouter>
  );
}
```
