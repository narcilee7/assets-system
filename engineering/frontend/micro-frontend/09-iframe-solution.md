# iframe 方案

## 1. 基本用法

```html
<!-- 主应用 -->
<div class="layout">
  <nav>主应用导航</nav>
  <iframe
    id="subapp"
    src="https://app-a.example.com"
    style="width: 100%; height: 100%; border: none;"
  ></iframe>
</div>
```

## 2. 通信（postMessage）

```javascript
// 主应用 → 子应用
const iframe = document.getElementById('subapp');
iframe.contentWindow.postMessage(
  { type: 'NAVIGATE', path: '/dashboard' },
  'https://app-a.example.com'  // targetOrigin（安全必须）
);

// 子应用 → 主应用
window.parent.postMessage(
  { type: 'LOGIN_SUCCESS', user: { name: 'John' } },
  'https://main.example.com'
);

// 主应用监听
window.addEventListener('message', (e) => {
  // 必须验证来源！
  if (e.origin !== 'https://app-a.example.com') return;

  if (e.data.type === 'LOGIN_SUCCESS') {
    console.log('User logged in:', e.data.user);
  }
});
```

## 3. 路由同步

```javascript
// 主应用 URL 变化时通知 iframe
window.addEventListener('popstate', () => {
  const path = window.location.pathname.replace('/app-a', '');
  iframe.contentWindow.postMessage({ type: 'ROUTE_CHANGE', path }, targetOrigin);
});

// 子应用内部路由变化时通知主应用
// React Router 中
const history = createBrowserHistory();
history.listen(({ location }) => {
  window.parent.postMessage(
    { type: 'CHILD_ROUTE_CHANGE', path: location.pathname },
    parentOrigin
  );
});

// 主应用更新 URL（不触发刷新）
window.addEventListener('message', (e) => {
  if (e.data.type === 'CHILD_ROUTE_CHANGE') {
    const newUrl = '/app-a' + e.data.path;
    window.history.replaceState(null, '', newUrl);
  }
});
```

## 4. 弹窗处理

```javascript
// 问题：iframe 内的弹窗被截断（不能超出 iframe 边界）

// 方案 1：弹窗提升到主应用
// iframe 内点击"打开弹窗" → postMessage 通知主应用 → 主应用渲染弹窗

// 方案 2：全屏 iframe（覆盖层）
// 需要弹窗时，iframe 高度设为 100vh，z-index 提高

// 方案 3：使用 Layer/Portal 在 iframe 内全屏
```

## 5. iframe 优缺点

| 优点 | 缺点 |
|------|------|
| 完全隔离（JS/CSS/DOM） | 性能开销（额外渲染进程） |
| 简单直接 | 弹窗/下拉框被截断 |
| 无需改造子应用 | 需要处理路由同步 |
| 天然安全 | 共享状态困难 |
| | SEO 不友好 |
