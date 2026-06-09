# JS 沙箱

## 1. 为什么需要 JS 沙箱

```javascript
// 子应用 A
window.user = { name: 'A' };

// 子应用 B
window.user = { name: 'B' };  // 覆盖了 A 的 user！

// 子应用 A 卸载后
window.addEventListener('scroll', handlerA);  // 监听没清理！
```

## 2. Snapshot Sandbox（快照沙箱）

```javascript
class SnapshotSandbox {
  constructor() {
    this.windowSnapshot = {};
    this.modifyPropsMap = {};
  }

  active() {
    // 激活时：记录 window 当前状态
    this.windowSnapshot = {};
    for (const key in window) {
      this.windowSnapshot[key] = window[key];
    }

    // 恢复之前修改的属性
    Object.keys(this.modifyPropsMap).forEach((key) => {
      window[key] = this.modifyPropsMap[key];
    });
  }

  inactive() {
    // 卸载时：记录修改的属性
    this.modifyPropsMap = {};
    for (const key in window) {
      if (window[key] !== this.windowSnapshot[key]) {
        this.modifyPropsMap[key] = window[key];
        window[key] = this.windowSnapshot[key];  // 恢复原始值
      }
    }
  }
}

// 使用
const sandbox = new SnapshotSandbox();

// 子应用激活
sandbox.active();
window.customVar = 'app-a';  // 修改 window

// 子应用卸载
sandbox.inactive();
// window.customVar 恢复到之前的状态
```

## 3. Proxy Sandbox（代理沙箱）

```javascript
class ProxySandbox {
  constructor() {
    this.fakeWindow = {};
    this.proxy = new Proxy(window, {
      get: (target, key) => {
        if (this.fakeWindow.hasOwnProperty(key)) {
          return this.fakeWindow[key];  // 优先返回 fakeWindow
        }
        return target[key];
      },
      set: (target, key, value) => {
        this.fakeWindow[key] = value;  // 只修改 fakeWindow
        return true;
      },
      has: (target, key) => {
        return key in this.fakeWindow || key in target;
      },
    });
  }

  active() {
    // 子应用在这个 proxy 上运行
  }

  inactive() {
    // 只需清空 fakeWindow
    this.fakeWindow = {};
  }
}

// 使用
const sandbox = new ProxySandbox();

// 子应用代码在这个 proxy 中执行
(function (window) {
  window.customVar = 'app-a';  // 实际存储在 fakeWindow
  console.log(window.customVar);  // 'app-a'
})(sandbox.proxy);
```

## 4. Legacy Sandbox（qiankun 多例模式）

```javascript
// 同时运行多个子应用时，每个子应用需要一个独立的沙箱
// qiankun 使用 Proxy Sandbox + 记录变更的混合方案

// 单个沙箱：SnapshotSandbox（单例模式）
// 多个沙箱：LegacySandbox（多例模式，基于 Proxy）
```

## 5. 副作用清理

```javascript
// 子应用需要清理的副作用：
// 1. setInterval / setTimeout
// 2. addEventListener
// 3. DOM 操作（添加到 body 的元素）
// 4. 全局变量修改

// qiankun 自动收集部分副作用，但最好子应用自行清理
export async function unmount() {
  // 清理定时器
  clearInterval(timerId);

  // 清理事件监听
  window.removeEventListener('resize', resizeHandler);

  // 清理 DOM
  document.querySelectorAll('.app-a-modal').forEach((el) => el.remove());

  // 卸载 React/Vue 组件
  ReactDOM.unmountComponentAtNode(container);
}
```
