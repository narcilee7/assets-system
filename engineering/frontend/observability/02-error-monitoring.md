# 错误监控

## 1. 错误类型与捕获

```javascript
// ============ JS 运行时错误 ============
window.onerror = (message, source, lineno, colno, error) => {
  report({
    type: 'js_error',
    message,
    filename: source,
    lineno,
    colno,
    stack: error?.stack,
  });
  return true;  // true = 不打印到控制台
};

// ============ Promise 未处理拒绝 ============
window.addEventListener('unhandledrejection', (event) => {
  report({
    type: 'promise_rejection',
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
  });
});

// ============ 资源加载错误 ============
window.addEventListener('error', (event) => {
  if (event.target instanceof HTMLElement) {
    report({
      type: 'resource_error',
      tag: event.target.tagName,      // IMG | SCRIPT | LINK
      src: event.target.src || event.target.href,
    });
  }
}, true);  // 捕获阶段监听

// ============ Vue 错误处理 ============
app.config.errorHandler = (err, vm, info) => {
  report({
    type: 'vue_error',
    message: err.message,
    stack: err.stack,
    component: vm?.$options?.name,
    info,
  });
};

// ============ React Error Boundary ============
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    report({
      type: 'react_error',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) return <FallbackUI />;
    return this.props.children;
  }
}
```

## 2. Source Map 处理

```javascript
// 生产环境不部署 source map，但上传到 Sentry
// build 时上传
// sentry-cli releases files "1.2.3" upload-sourcemaps ./dist --url-prefix ~/static/

// 错误堆栈还原
const { SourceMapConsumer } = require('source-map');

async function resolveStack(stack, sourceMap) {
  const consumer = await new SourceMapConsumer(sourceMap);

  const lines = stack.split('\n').map((line) => {
    const match = line.match(/at (.+) \((.+):(\d+):(\d+)\)/);
    if (!match) return line;

    const [, fn, file, lineNo, colNo] = match;
    const original = consumer.originalPositionFor({
      line: Number(lineNo),
      column: Number(colNo),
    });

    return `at ${fn} (${original.source}:${original.line}:${original.column})`;
  });

  return lines.join('\n');
}
```

## 3. 错误分类与聚合

```javascript
// 错误指纹：同一类错误应该聚合
function getFingerprint(error) {
  // 方法 1：消息哈希
  const msg = error.message.replace(/\d+/g, '#');  // 去掉数字
  return hash(msg);

  // 方法 2：堆栈首帧
  const frame = parseStack(error.stack)[0];
  return `${frame.filename}:${frame.function}`;

  // 方法 3：组合
  return hash(`${error.type}:${frame.function}:${msg}`);
}

// 错误分级
function getSeverity(error) {
  if (error.type === 'api_error' && error.status >= 500) return 'critical';
  if (error.message?.includes('out of memory')) return 'critical';
  if (error.count > 100) return 'high';
  if (error.count > 10) return 'medium';
  return 'low';
}

// 降噪策略
const NOISE_PATTERNS = [
  /ResizeObserver loop/,           // Chrome 无害警告
  /Non-Error promise rejection/,   // 空 rejection
  /Script error\./,                // 跨域脚本错误（无信息）
  /chrome-extension/,              // 浏览器扩展错误
];

function isNoise(error) {
  return NOISE_PATTERNS.some((p) => p.test(error.message));
}
```

## 4. 错误上下文

```javascript
// 收集错误发生时的上下文
function getContext() {
  return {
    url: location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language,
    connection: navigator.connection?.effectiveType,
    memory: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
    online: navigator.onLine,
    // 最近的用户操作
    recentActions: actionBuffer.slice(-10),
    // 最近的 console 日志
    recentLogs: logBuffer.slice(-20),
  };
}
```
