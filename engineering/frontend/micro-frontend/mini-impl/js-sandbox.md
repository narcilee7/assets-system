# 手写 JS 沙箱

## 1. Proxy Sandbox（现代浏览器）

```javascript
// proxy-sandbox.js

class ProxySandbox {
  constructor() {
    this.fakeWindow = Object.create(null);
    this.proxy = null;
    this.running = false;
    this.createProxy();
  }

  createProxy() {
    const fakeWindow = this.fakeWindow;
    const originalWindow = window;

    this.proxy = new Proxy(fakeWindow, {
      get(target, key) {
        // 优先从 fakeWindow 读取
        if (fakeWindow.hasOwnProperty(key)) {
          return fakeWindow[key];
        }

        // 否则从真实 window 读取
        const value = originalWindow[key];

        // 防止 this 绑定问题
        if (typeof value === 'function' && !value.prototype) {
          return value.bind(originalWindow);
        }

        return value;
      },

      set(target, key, value) {
        // 只修改 fakeWindow
        fakeWindow[key] = value;
        return true;
      },

      has(target, key) {
        return key in fakeWindow || key in originalWindow;
      },

      deleteProperty(target, key) {
        delete fakeWindow[key];
        return true;
      },

      ownKeys() {
        return Object.keys(fakeWindow);
      },

      getOwnPropertyDescriptor(target, key) {
        if (fakeWindow.hasOwnProperty(key)) {
          return {
            value: fakeWindow[key],
            writable: true,
            enumerable: true,
            configurable: true,
          };
        }
        return Object.getOwnPropertyDescriptor(originalWindow, key);
      },
    });
  }

  active() {
    this.running = true;
  }

  inactive() {
    this.running = false;
    // 清空 fakeWindow，释放内存
    Object.keys(this.fakeWindow).forEach((key) => {
      delete this.fakeWindow[key];
    });
  }

  getSandbox() {
    return this.proxy;
  }
}

// ============ 测试 ============

const sandbox = new ProxySandbox();
sandbox.active();

const proxyWindow = sandbox.getSandbox();

// 在沙箱中执行
proxyWindow.customVar = 'app-a';
console.log(proxyWindow.customVar);  // 'app-a'
console.log(window.customVar);        // undefined（未污染真实 window）

// 可以访问原生 API
console.log(proxyWindow.document);    // 真实 document
console.log(proxyWindow.fetch);       // 真实 fetch

sandbox.inactive();
```

## 2. Snapshot Sandbox（兼容方案）

```javascript
// snapshot-sandbox.js

class SnapshotSandbox {
  constructor() {
    this.windowSnapshot = {};
    this.modifyPropsMap = {};
    this.active = false;
  }

  // 激活沙箱
  activate() {
    // 记录当前 window 状态
    this.windowSnapshot = {};
    for (const key in window) {
      if (window.hasOwnProperty(key)) {
        this.windowSnapshot[key] = window[key];
      }
    }

    // 恢复之前的修改
    Object.keys(this.modifyPropsMap).forEach((key) => {
      window[key] = this.modifyPropsMap[key];
    });

    this.active = true;
  }

  // 停用沙箱
  deactivate() {
    this.modifyPropsMap = {};

    // 对比并恢复
    for (const key in window) {
      if (window.hasOwnProperty(key)) {
        if (window[key] !== this.windowSnapshot[key]) {
          // 记录修改
          this.modifyPropsMap[key] = window[key];
          // 恢复原始值
          window[key] = this.windowSnapshot[key];
        }
      }
    }

    // 处理新增的属性
    Object.keys(window).forEach((key) => {
      if (!this.windowSnapshot.hasOwnProperty(key)) {
        this.modifyPropsMap[key] = window[key];
        delete window[key];
      }
    });

    this.active = false;
  }
}

// ============ 测试 ============

const sandbox = new SnapshotSandbox();

sandbox.activate();
window.appAVar = 'hello';
window.appAFunc = () => {};

sandbox.deactivate();
console.log(window.appAVar);   // undefined（已清理）

sandbox.activate();            // 再次激活
console.log(window.appAVar);   // 'hello'（恢复）
```
