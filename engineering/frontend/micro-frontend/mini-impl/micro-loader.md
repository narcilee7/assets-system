# 手写微前端加载器

## 1. 核心加载器

```javascript
// mini-micro-frontend.js

class MicroFrontendLoader {
  constructor() {
    this.apps = new Map();        // 注册的应用
    this.activeApp = null;        // 当前激活的应用
  }

  // 注册应用
  register(name, config) {
    this.apps.set(name, {
      name,
      entry: config.entry,         // HTML 入口 URL
      container: config.container, // 挂载容器选择器
      activeRule: config.activeRule, // 激活规则（路径匹配）
      status: 'NOT_LOADED',        // NOT_LOADED | LOADING | LOADED | MOUNTED
      lifecycle: null,             // 子应用生命周期
      sandbox: null,               // 沙箱实例
    });
  }

  // 启动
  start() {
    // 监听路由变化
    window.addEventListener('popstate', () => this.checkActiveApp());
    window.addEventListener('hashchange', () => this.checkActiveApp());

    // 劫持 history.pushState/replaceState
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.checkActiveApp();
    };

    // 初始检查
    this.checkActiveApp();
  }

  // 检查哪个应用应该激活
  checkActiveApp() {
    const currentPath = window.location.pathname;

    for (const [name, app] of this.apps) {
      const isActive = this.isActive(app.activeRule, currentPath);

      if (isActive && app.status !== 'MOUNTED') {
        this.loadAndMountApp(app);
      } else if (!isActive && app.status === 'MOUNTED') {
        this.unmountApp(app);
      }
    }
  }

  // 判断是否激活
  isActive(rule, path) {
    if (typeof rule === 'string') {
      return path.startsWith(rule);
    }
    if (rule instanceof RegExp) {
      return rule.test(path);
    }
    if (typeof rule === 'function') {
      return rule(path);
    }
    return false;
  }

  // 加载并挂载应用
  async loadAndMountApp(app) {
    if (app.status === 'NOT_LOADED') {
      app.status = 'LOADING';

      try {
        // 1. 加载 HTML Entry
        const html = await fetch(app.entry).then((r) => r.text());

        // 2. 解析 HTML（提取 JS/CSS）
        const { scripts, styles } = this.parseHTML(html, app.entry);

        // 3. 创建沙箱
        app.sandbox = new ProxySandbox();
        app.sandbox.active();

        // 4. 加载 CSS
        for (const style of styles) {
          await this.loadStyle(style, app);
        }

        // 5. 加载并执行 JS（在沙箱中）
        const lifecycle = await this.loadScripts(scripts, app);
        app.lifecycle = lifecycle;
        app.status = 'LOADED';
      } catch (err) {
        console.error(`Failed to load app ${app.name}:`, err);
        app.status = 'NOT_LOADED';
        return;
      }
    }

    if (app.status === 'LOADED') {
      // 6. 挂载应用
      const container = document.querySelector(app.container);
      if (app.lifecycle.mount) {
        await app.lifecycle.mount({ container });
      }
      app.status = 'MOUNTED';
      this.activeApp = app;
    }
  }

  // 卸载应用
  async unmountApp(app) {
    if (app.lifecycle.unmount) {
      await app.lifecycle.unmount();
    }
    app.sandbox?.inactive();
    app.status = 'LOADED';  // 保持 LOADED 以便快速重新挂载
    this.activeApp = null;
  }

  // 解析 HTML
  parseHTML(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const scripts = [];
    const styles = [];

    // 提取 JS
    doc.querySelectorAll('script[src]').forEach((script) => {
      scripts.push(new URL(script.src, baseUrl).href);
    });

    // 提取内联 JS
    doc.querySelectorAll('script:not([src])').forEach((script) => {
      scripts.push({ inline: true, content: script.textContent });
    });

    // 提取 CSS
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      styles.push(new URL(link.href, baseUrl).href);
    });

    return { scripts, styles };
  }

  // 加载样式
  async loadStyle(url, app) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-app', app.name);
    document.head.appendChild(link);
  }

  // 加载并执行脚本
  async loadScripts(scripts, app) {
    const lifecycle = {};

    for (const script of scripts) {
      if (typeof script === 'string') {
        // 外部脚本
        const code = await fetch(script).then((r) => r.text());
        this.execScript(code, app);
      } else {
        // 内联脚本
        this.execScript(script.content, app);
      }
    }

    // 从沙箱中获取生命周期
    const sandboxWindow = app.sandbox.getSandbox();
    return {
      bootstrap: sandboxWindow.bootstrap,
      mount: sandboxWindow.mount,
      unmount: sandboxWindow.unmount,
    };
  }

  // 在沙箱中执行脚本
  execScript(code, app) {
    const sandboxWindow = app.sandbox.getSandbox();
    const wrappedCode = `
      (function(window, self, globalThis) {
        with(window) {
          ${code}
        }
      })(window, window, window);
    `;
    // 使用 Function 在沙箱 window 上下文中执行
    const fn = sandboxWindow.Function(wrappedCode);
    fn();
  }
}

// ============ 使用 ============

const loader = new MicroFrontendLoader();

loader.register('app-a', {
  entry: 'http://localhost:3001',
  container: '#subapp-container',
  activeRule: '/app-a',
});

loader.register('app-b', {
  entry: 'http://localhost:3002',
  container: '#subapp-container',
  activeRule: '/app-b',
});

loader.start();
```
