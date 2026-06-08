# 跨平台可观测性

## 1. WebView 监控

```javascript
// WebView 中的异常需要通过 Bridge 上报到 Native

// ============ WebView -> Native 桥接 ============
const Bridge = {
  postMessage(type, data) {
    if (window.ReactNativeWebView) {
      // React Native WebView
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
    } else if (window.webkit?.messageHandlers?.monitor) {
      // iOS WKWebView
      window.webkit.messageHandlers.monitor.postMessage({ type, data });
    } else if (window.AndroidBridge?.report) {
      // Android WebView
      window.AndroidBridge.report(JSON.stringify({ type, data }));
    }
  },
};

// ============ 错误上报 ============
window.onerror = (msg, source, line, col, error) => {
  Bridge.postMessage('error', {
    message: msg,
    stack: error?.stack,
    source,
    line,
    col,
    url: location.href,
    userAgent: navigator.userAgent,
  });
};

// ============ 性能上报 ============
window.addEventListener('load', () => {
  setTimeout(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    Bridge.postMessage('performance', {
      domReady: nav.domContentLoadedEventEnd - nav.startTime,
      loadComplete: nav.loadEventEnd - nav.startTime,
      lcp: getLCP(),  // 从 PerformanceObserver 获取
    });
  }, 0);
});

// ============ 白屏检测 ============
function detectWhiteScreen() {
  const check = () => {
    const visibleElements = document.querySelectorAll('body *:not(script)');
    const hasContent = Array.from(visibleElements).some((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (!hasContent) {
      Bridge.postMessage('white_screen', {
        url: location.href,
        timestamp: Date.now(),
        htmlSize: document.documentElement.outerHTML.length,
      });
    }
  };

  setTimeout(check, 5000);   // 5 秒后检测
  setTimeout(check, 10000);  // 10 秒后再次检测
}
```

## 2. React Native 监控

```javascript
// React Native Error Boundary
import { ErrorUtils } from 'react-native';

// 捕获 JS 异常
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  report({
    type: 'rn_error',
    message: error.message,
    stack: error.stack,
    isFatal,
    platform: Platform.OS,
    version: Platform.Version,
    appVersion: DeviceInfo.getVersion(),
  });
  originalHandler(error, isFatal);
});

// 捕获 Native 异常（通过 Native Module）
import { NativeModules } from 'react-native';
const { CrashReporter } = NativeModules;

CrashReporter.setCrashCallback((report) => {
  // Native 崩溃信息
});

// 性能监控
import { Performance } from 'react-native-performance';

Performance.mark('app_start');
// ... 应用启动 ...
Performance.measure('app_startup', 'app_start');
```

## 3. 小程序监控

```javascript
// 微信小程序
App({
  onError(msg) {
    wx.reportMonitor('js_error', 1);
    wx.request({
      url: 'https://monitor.example.com/log',
      method: 'POST',
      data: {
        type: 'error',
        message: msg,
        appVersion: wx.getAccountInfoSync().miniProgram.version,
        systemInfo: wx.getSystemInfoSync(),
      },
    });
  },

  onPageNotFound(res) {
    wx.reportMonitor('page_not_found', 1);
  },

  onLaunch() {
    this.startTime = Date.now();
  },

  onShow() {
    const startupTime = Date.now() - this.startTime;
    wx.reportMonitor('startup_time', startupTime);
  },
});

// 页面性能
Page({
  onLoad() {
    this.pageStart = Date.now();
  },

  onReady() {
    const pageLoadTime = Date.now() - this.pageStart;
    wx.reportMonitor('page_load_time', pageLoadTime);
  },
});
```

## 4. 跨平台统一 Schema

```javascript
// 所有平台的监控数据统一格式
const unifiedEvent = {
  // 通用字段
  timestamp: Date.now(),
  platform: 'web' | 'rn' | 'miniapp' | 'webview',
  appVersion: '1.2.3',
  os: 'iOS 16.0',
  device: 'iPhone14,2',

  // 事件字段
  type: 'error' | 'performance' | 'behavior',

  // Web Vitals（仅 web/webview）
  lcp: 2.1,
  cls: 0.05,

  // 错误信息
  error: {
    message: '...',
    stack: '...',
  },

  // 性能信息
  performance: {
    domReady: 1200,
    loadComplete: 2500,
  },

  // 行为信息
  behavior: {
    type: 'click',
    target: 'button#buy',
  },
};
```
