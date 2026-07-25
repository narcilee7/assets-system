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
        if (typeof value === "function" && !value.prototype) {
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
