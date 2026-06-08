# 状态共享

## 1. 共享状态分类

```
需要共享的状态：
├─ 用户登录态（token、用户信息）
├─ 主题 / 语言
├─ 全局配置
├─ 通知 / 消息
└─ 权限信息

不应共享的状态：
├─ 子应用内部业务状态
├─ 子应用路由状态
└─ 子应用 UI 状态
```

## 2. Props 传递

```javascript
// 主应用向子应用传递状态
registerMicroApps([
  {
    name: 'app-a',
    entry: '//localhost:3001',
    container: '#container',
    activeRule: '/app-a',
    props: {
      user: { name: 'John', role: 'admin' },
      theme: 'dark',
      lang: 'zh-CN',
    },
  },
]);

// 子应用接收
export async function mount(props) {
  console.log(props.user);   // { name: 'John', role: 'admin' }
  console.log(props.theme);  // 'dark'
}
```

## 3. 全局状态（qiankun actions）

```javascript
// 主应用初始化
import { initGlobalState } from 'qiankun';

const actions = initGlobalState({
  user: null,
  theme: 'light',
});

// 主应用修改状态
actions.setGlobalState({ user: { name: 'John' } });

// 主应用监听
actions.onGlobalStateChange((state, prev) => {
  console.log('State changed:', state);
});

// 子应用使用
export async function mount(props) {
  props.onGlobalStateChange((state, prev) => {
    // 响应全局状态变化
    if (state.theme !== prev.theme) {
      applyTheme(state.theme);
    }
  });

  // 子应用也可以修改全局状态
  props.setGlobalState({ theme: 'dark' });
}
```

## 4. Event Bus

```javascript
// 简单 Event Bus（挂载到 window）
class MicroEventBus {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    (this.events[event] ||= []).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  emit(event, data) {
    (this.events[event] || []).forEach((cb) => cb(data));
  }
}

window.microBus = new MicroEventBus();

// 应用 A 登录后广播
window.microBus.emit('login', { token: 'abc123', user: { name: 'John' } });

// 应用 B 监听
window.microBus.on('login', ({ token, user }) => {
  localStorage.setItem('token', token);
  updateUserInfo(user);
});
```

## 5. URL 状态共享

```javascript
// 通过 URL 参数传递状态
// /app-a/dashboard?theme=dark&lang=zh

// 子应用读取
const params = new URLSearchParams(window.location.search);
const theme = params.get('theme');

// 优点：刷新后状态保留、可分享链接
// 缺点：只适合简单数据、URL 变长
```
