# WebView 白屏治理

## 白屏根因分类

```
白屏
├── 加载阶段
│   ├── 网络失败（DNS、TCP、HTTP 错误）
│   ├── 证书错误（HTTPS 自签名、过期）
│   ├── 离线包损坏（ZIP 校验失败、文件缺失）
│   └── 服务器 5xx（网关超时、服务宕机）
├── 解析阶段
│   ├── JS 语法错误（旧容器不兼容新语法）
│   ├── 资源加载失败（CSS/JS 404）
│   └── 第三方脚本阻塞（统计、广告 SDK）
└── 渲染阶段
    ├── JS 运行时错误（undefined is not a function）
    ├── 内存溢出（大图、循环引用）
    └── 容器兼容性问题（特定 WebView 版本 Bug）
```

## 1. 监控指标体系

```typescript
// 白屏监控指标
interface WhiteScreenMetrics {
  // 加载指标
  ttfb: number;              // Time To First Byte
  fcp: number;               // First Contentful Paint
  lcp: number;               // Largest Contentful Paint

  // 错误指标
  resourceErrors: Array<{
    url: string;
    type: 'script' | 'stylesheet' | 'image' | 'xhr';
    error: string;
  }>;
  jsErrors: Array<{
    message: string;
    stack: string;
    filename: string;
    lineno: number;
  }>;

  // 容器信息
  containerVersion: string;
  webviewVersion: string;
  userAgent: string;
}

// 上报逻辑
window.addEventListener('error', (event) => {
  reportError({
    type: 'js_error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    stack: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportError({
    type: 'promise_rejection',
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
  });
});
```

## 2. 白屏检测方案

```typescript
// 基于 DOM 元素检测白屏
function detectWhiteScreen(): boolean {
  const criticalElements = [
    document.body,
    document.querySelector('#root'),
    document.querySelector('.app-container'),
  ];

  // 检查关键元素是否存在且有内容
  const hasContent = criticalElements.some(el => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.height > 0 && el.innerHTML.trim().length > 0;
  });

  return !hasContent;
}

// 定时检测（页面加载后 3s、5s、10s）
[3000, 5000, 10000].forEach(delay => {
  setTimeout(() => {
    if (detectWhiteScreen()) {
      reportError({
        type: 'white_screen',
        delay,
        url: location.href,
        containerInfo: window.__container__,
      });

      // 自动降级：刷新页面或跳转错误页
      autoRecover();
    }
  }, delay);
});
```

## 3. 自动降级策略

```typescript
function autoRecover() {
  const recoverStrategies = [
    // 策略 1：禁用缓存刷新
    () => {
      location.reload(true);
    },
    // 策略 2：切换到在线模式（如果当前是离线包）
    () => {
      if (window.__container__?.offlineMode) {
        JSBridge.invoke('offline', 'disable').then(() => {
          location.reload();
        });
      }
    },
    // 策略 3：跳转到错误页
    () => {
      location.href = '/error.html?code=white_screen&from=' + encodeURIComponent(location.href);
    },
  ];

  // 按优先级执行
  const attempt = parseInt(sessionStorage.getItem('recover_attempt') || '0');
  if (attempt < recoverStrategies.length) {
    sessionStorage.setItem('recover_attempt', String(attempt + 1));
    recoverStrategies[attempt]();
  }
}

// 页面正常加载后重置恢复计数
window.addEventListener('load', () => {
  sessionStorage.removeItem('recover_attempt');
});
```

## 4. 容器层兜底

```kotlin
// Android WebView 错误页兜底
override fun onReceivedError(
    view: WebView,
    request: WebResourceRequest,
    error: WebResourceError
) {
    if (request.isForMainFrame) {
        // 主框架加载失败，显示原生错误页
        showErrorPage(error.errorCode, error.description.toString())
    }
}

override fun onReceivedHttpError(
    view: WebView,
    request: WebResourceRequest,
    errorResponse: WebResourceResponse
) {
    if (request.isForMainFrame && errorResponse.statusCode >= 500) {
        showErrorPage(errorResponse.statusCode, "Server Error")
    }
}

private fun showErrorPage(code: Int, message: String) {
    webView.visibility = View.GONE
    errorView.visibility = View.VISIBLE
    errorView.findViewById<TextView>(R.id.errorCode).text = "Error $code"
    errorView.findViewById<TextView>(R.id.errorMessage).text = message
    errorView.findViewById<Button>(R.id.retryButton).setOnClickListener {
        webView.visibility = View.VISIBLE
        errorView.visibility = View.GONE
        webView.reload()
    }
}
```
