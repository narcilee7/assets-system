# Lynx 调试与监控

## 1. Lynx DevTool

Lynx DevTool 是类似 Chrome DevTools 的调试工具，支持：
- Element Inspector（查看 Element Tree）
- Console（日志输出）
- Network（请求监控）
- Performance（性能分析）
- Memory（内存分析）

### 连接方式

```bash
# 启动 DevTool 服务器
lynx devtool --port 9222

# 手机连接后，在 DevTool 中选择对应设备
# 支持 iOS/Android 真机和模拟器
```

### Element Inspector

```
┌─────────────────────────────────────────┐
│  Lynx DevTool - Element                 │
├─────────────────────────────────────────┤
│                                         │
│  ▼ view (class: feed-page)              │
│    ▼ view (class: feed-card)            │
│      ▶ image (src: https://...)         │
│      ▼ view (class: body)               │
│        ▶ text (content: "标题")          │
│      ▶ view (class: footer)             │
│                                         │
├─────────────────────────────────────────┤
│  Styles                                 │
│  width: 100%                            │
│  height: 320px                          │
│  background-color: #fff                 │
│  border-radius: 8px                     │
│                                         │
│  Computed                               │
│  layout: { x: 0, y: 100, w: 375, h: 320 }│
└─────────────────────────────────────────┘
```

## 2. 日志体系

### 分级日志

```javascript
// JS 层日志
lynx.log.info('页面加载完成', { page: 'Feed', time: 200 });
lynx.log.warn('图片加载慢', { url, duration: 3000 });
lynx.log.error('请求失败', { url, error: err.message });

// 原生层日志（iOS）
NSLog(@"[Lynx][INFO] Element created: %@", elementName);
```

### 日志上报

```javascript
// 日志聚合器
class LogCollector {
  constructor() {
    this.logs = [];
    this.maxSize = 100;
  }

  collect(level, message, extra = {}) {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      extra,
      page: getCurrentPage(),
    });

    if (this.logs.length >= this.maxSize) {
      this.flush();
    }
  }

  flush() {
    if (this.logs.length === 0) return;

    lynx.request({
      url: '/api/log',
      method: 'POST',
      data: { logs: this.logs.splice(0, this.logs.length) },
    });
  }
}

// 错误边界
class ErrorBoundary {
  static catch(error, info) {
    logCollector.collect('error', error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }
}
```

## 3. 性能分析

### 启动性能埋点

```javascript
// app.jsx
const perfMarks = {
  bundleLoadStart: performance.now(),
};

// Tasm 解析完成
lynx.onTasmReady = () => {
  perfMarks.tasmReady = performance.now();
};

// 首屏渲染完成
lynx.onFirstScreen = () => {
  perfMarks.firstScreen = performance.now();

  // 上报
  lynx.reportMetric({
    name: 'lynx_first_screen',
    value: perfMarks.firstScreen - perfMarks.bundleLoadStart,
    tags: {
      page: 'Feed',
      bundleSize: '__BUNDLE_SIZE__',
    },
  });
};

// 可交互时间
lynx.onTTI = () => {
  perfMarks.tti = performance.now();
};
```

### 列表性能分析

```javascript
// 列表滑动帧率监控
let frameCount = 0;
let lastTime = performance.now();

function measureFPS() {
  frameCount++;
  const now = performance.now();

  if (now - lastTime >= 1000) {
    const fps = Math.round(frameCount * 1000 / (now - lastTime));

    if (fps < 50) {
      lynx.log.warn('列表滑动掉帧', { fps, page: 'Feed' });
    }

    frameCount = 0;
    lastTime = now;
  }

  requestAnimationFrame(measureFPS);
}

measureFPS();
```

## 4. 内存泄漏定位

### 常见泄漏场景

| 场景 | 原因 | 检测方法 |
|------|------|----------|
| 图片缓存 | 大图未释放 | Memory 面板查看 Image 对象 |
| 事件监听 | 组件卸载未移除监听 | DevTool 检查 Event Listener |
| 定时器 | setInterval 未清除 | Heap Snapshot 对比 |
| 闭包引用 | 回调持有外部变量 | Retainer 链分析 |

### 检测代码

```javascript
// 内存使用监控
setInterval(() => {
  const memory = lynx.getMemoryInfo();
  console.log('Memory:', {
    used: memory.usedJSHeapSize / 1024 / 1024 + 'MB',
    total: memory.totalJSHeapSize / 1024 / 1024 + 'MB',
  });

  if (memory.usedJSHeapSize > 150 * 1024 * 1024) {
    lynx.log.warn('内存使用过高', { memory });
  }
}, 30000);
```

## 5. 线上监控

### 监控指标设计

```javascript
// metrics.js
const METRICS = {
  // 性能指标
  PERFORMANCE: {
    FCP: 'lynx_fcp',           // First Contentful Paint
    TTI: 'lynx_tti',           // Time to Interactive
    LOAD_TIME: 'lynx_load',    // 页面加载时间
    FPS: 'lynx_fps',           // 滑动帧率
  },

  // 稳定性指标
  STABILITY: {
    JS_ERROR: 'lynx_js_error',
    NATIVE_ERROR: 'lynx_native_error',
    CRASH: 'lynx_crash',
    ANR: 'lynx_anr',
  },

  // 业务指标
  BUSINESS: {
    PAGE_VIEW: 'lynx_pv',
    CLICK: 'lynx_click',
    CONVERSION: 'lynx_conversion',
  },
};

// 上报封装
function reportMetric(name, value, tags = {}) {
  lynx.request({
    url: '/api/metrics',
    method: 'POST',
    data: {
      name,
      value,
      tags: {
        ...tags,
        platform: lynx.getSystemInfoSync().platform,
        appVersion: '__APP_VERSION__',
        lynxVersion: '__LYNX_VERSION__',
      },
      timestamp: Date.now(),
    },
  });
}
```

### 告警规则

| 指标 | 阈值 | 级别 |
|------|------|------|
| FCP > 1s | P99 | 警告 |
| FCP > 2s | P99 | 严重 |
| JS Error Rate > 1% | 5min | 警告 |
| Crash Rate > 0.1% | 5min | 严重 |
| FPS < 45 | 持续5s | 警告 |
