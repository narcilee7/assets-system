# 错误追踪

## 1. 全局错误捕获

```javascript
// 1. 同步错误
window.onerror = function (message, source, lineno, colno, error) {
  reportError({
    type: 'js_error',
    message,
    source,
    lineno,
    colno,
    stack: error?.stack,
  });
  return false; // true = 阻止默认处理（控制台不输出）
};

// 2. Promise 未捕获异常
window.addEventListener('unhandledrejection', (event) => {
  reportError({
    type: 'unhandledrejection',
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
  });
});

// 3. 资源加载失败
window.addEventListener('error', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement) {
    reportError({
      type: 'resource_error',
      url: target.src || target.href,
      tagName: target.tagName,
    });
  }
}, true); // 捕获阶段监听，才能捕获资源错误

// 4. console.error 劫持（开发环境慎用）
const originalError = console.error;
console.error = function (...args) {
  reportError({
    type: 'console_error',
    message: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
  });
  originalError.apply(this, args);
};
```

## 2. 框架级错误边界

```tsx
// React Error Boundary
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError({
      type: 'react_error_boundary',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Vue 3 错误处理
app.config.errorHandler = (err, instance, info) => {
  reportError({
    type: 'vue_error',
    message: err.message,
    stack: err.stack,
    component: instance?.$options?.name,
    info,
  });
};
```

## 3. Source Map 解析

```bash
# 1. 构建时生成 Source Map
# vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true,  // 生成 .map 文件
  },
});

# 2. 上传 Source Map 到监控平台（不暴露给用户）
# 构建后上传，然后删除 .map 文件
# sentry-cli sourcemaps upload dist/ --release=1.2.3

# 3. 服务端解析堆栈
# source-map 库
const { SourceMapConsumer } = require('source-map');

async function parseStack(stack, sourceMap) {
  const consumer = await new SourceMapConsumer(sourceMap);
  const lines = stack.split('\n');

  return lines.map((line) => {
    const match = line.match(/at .* \((.+):(\d+):(\d+)\)/);
    if (!match) return line;

    const [, source, lineNum, colNum] = match;
    const original = consumer.originalPositionFor({
      line: parseInt(lineNum),
      column: parseInt(colNum),
    });

    return `at ${original.name || ''} (${original.source}:${original.line}:${original.column})`;
  });
}
```

## 4. 错误上报协议

```javascript
// 统一上报格式
function reportError(errorInfo) {
  const payload = {
    // 错误信息
    type: errorInfo.type,
    message: errorInfo.message,
    stack: errorInfo.stack,

    // 上下文
    url: location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),

    // 用户标识（脱敏）
    userId: getAnonymousUserId(),
    sessionId: getSessionId(),

    // 环境
    release: window.__APP_VERSION__,
    env: process.env.NODE_ENV,

    // 性能上下文
    performance: {
      loadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart,
    },
  };

  // 发送到服务端（使用 sendBeacon 保证可靠性）
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/error', JSON.stringify(payload));
  } else {
    fetch('/api/error', {
      method: 'POST',
      body: JSON.stringify(payload),
      keepalive: true,
    });
  }
}
```
