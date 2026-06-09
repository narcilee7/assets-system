# 手写错误捕获系统

## 1. 完整错误捕获

```javascript
// mini-error-capture.js

class ErrorCapture {
  constructor(options = {}) {
    this.onError = options.onError || console.error;
    this.maxStackDepth = options.maxStackDepth || 50;
    this.collectors = [];
  }

  init() {
    this.captureJS();
    this.capturePromise();
    this.captureResource();
    this.captureConsole();
    this.captureFrameWork();
  }

  // ============ JS 运行时错误 ============
  captureJS() {
    window.addEventListener('error', (event) => {
      // 过滤跨域脚本错误（无信息）
      if (event.message === 'Script error.' && !event.filename) {
        return;
      }

      this.handle({
        type: 'js_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: this.parseStack(event.error?.stack),
        timestamp: Date.now(),
      });
    });
  }

  // ============ Promise 拒绝 ============
  capturePromise() {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;

      this.handle({
        type: 'promise_rejection',
        message: reason?.message || String(reason),
        stack: this.parseStack(reason?.stack),
        timestamp: Date.now(),
      });
    });

    window.addEventListener('rejectionhandled', (event) => {
      // Promise 后续被处理了，可以记录用于分析
      this.handle({
        type: 'rejection_handled',
        message: event.reason?.message,
        timestamp: Date.now(),
      });
    });
  }

  // ============ 资源加载错误 ============
  captureResource() {
    window.addEventListener('error', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        this.handle({
          type: 'resource_error',
          tag: target.tagName,
          src: target.src || target.href,
          timestamp: Date.now(),
        });
      }
    }, true);  // 捕获阶段
  }

  // ============ Console 错误 ============
  captureConsole() {
    const originalError = console.error;
    console.error = (...args) => {
      originalError.apply(console, args);

      const message = args.map((a) =>
        a instanceof Error ? a.message : String(a)
      ).join(' ');

      this.handle({
        type: 'console_error',
        message,
        timestamp: Date.now(),
      });
    };
  }

  // ============ 框架集成钩子 ============
  captureFrameWork() {
    // React
    if (window.React) {
      const original = React.Component.prototype.componentDidCatch;
      React.Component.prototype.componentDidCatch = function(error, info) {
        this.handle({
          type: 'react_error',
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
        });
        if (original) original.call(this, error, info);
      };
    }

    // Vue
    if (window.Vue) {
      Vue.config.errorHandler = (err, vm, info) => {
        this.handle({
          type: 'vue_error',
          message: err.message,
          stack: err.stack,
          component: vm?.$options?.name,
          info,
        });
      };
    }
  }

  // ============ 堆栈解析 ============
  parseStack(stack) {
    if (!stack) return [];

    return stack
      .split('\n')
      .slice(0, this.maxStackDepth)
      .map((line) => {
        const match = line.match(/at\s+(.*?)\s+\((.*?):(\d+):(\d+)\)/);
        if (match) {
          return {
            function: match[1],
            filename: match[2],
            lineno: Number(match[3]),
            colno: Number(match[4]),
          };
        }
        return { raw: line };
      });
  }

  // ============ 错误处理 ============
  handle(error) {
    const enriched = {
      ...error,
      url: location.href,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };

    this.onError(enriched);
  }
}

// ============ 使用 ============
const capture = new ErrorCapture({
  onError: (error) => {
    console.log('Captured:', error);
    // 上报到监控系统
    fetch('/api/errors', {
      method: 'POST',
      body: JSON.stringify(error),
    });
  },
});

capture.init();
```

## 2. Source Map 解析器

```javascript
// 简化版 source map 解析
async function resolveStackTrace(stack, sourceMapUrl) {
  const response = await fetch(sourceMapUrl);
  const sourceMap = await response.json();

  const consumer = await new SourceMapConsumer(sourceMap);

  const resolved = stack.map((frame) => {
    if (!frame.lineno) return frame;

    const pos = consumer.originalPositionFor({
      line: frame.lineno,
      column: frame.colno || 0,
    });

    return {
      ...frame,
      originalFile: pos.source,
      originalLine: pos.line,
      originalColumn: pos.column,
      originalFunction: pos.name || frame.function,
    };
  });

  consumer.destroy();
  return resolved;
}
```
