# WebView 容器设计

## 容器职责

WebView 容器不是简单的浏览器壳，而是**原生应用与 H5 之间的中间层**：
- **生命周期管理**：页面加载、可见性变化、销毁清理
- **能力注入**：JSBridge、Cookie、Header、UA
- **导航控制**：返回键、标题栏、进度条、错误页
- **安全策略**：域名白名单、HTTPS 强制、XSS 防护

## 1. 容器配置

```typescript
// 容器配置接口
interface WebViewConfig {
  // 基础配置
  url: string;
  userAgent?: string;           // 追加的 UA 片段
  headers?: Record<string, string>;

  // 功能开关
  javascriptEnabled: boolean;
  domStorageEnabled: boolean;
  cacheEnabled: boolean;
  zoomEnabled: boolean;

  // 安全
  allowUniversalAccessFromFileURLs: boolean;
  mixedContentMode?: 'always_allow' | 'never_allow' | 'compatibility';
  trustedDomains?: string[];    // 域名白名单

  // UI
  showNavigationBar: boolean;
  showProgressBar: boolean;
  pullToRefresh: boolean;

  // 离线
  offlinePackageId?: string;
  fallbackUrl?: string;
}

// 默认配置
const defaultConfig: WebViewConfig = {
  javascriptEnabled: true,
  domStorageEnabled: true,
  cacheEnabled: true,
  zoomEnabled: false,
  allowUniversalAccessFromFileURLs: false,
  mixedContentMode: 'never_allow',
  showNavigationBar: true,
  showProgressBar: true,
  pullToRefresh: false,
};
```

## 2. 生命周期管理

```
容器启动
    │
    ▼
┌─────────────┐
│   Loading   │ ──▶ 显示骨架屏 / 进度条
│  (加载中)    │
└──────┬──────┘
       │ onPageStarted
       ▼
┌─────────────┐
│  Commit     │ ──▶ DOM 开始解析
│ (首字节到达) │
└──────┬──────┘
       │ onPageCommitVisible
       ▼
┌─────────────┐
│   Loaded    │ ──▶ 隐藏进度条，调用 JS 注入
│  (加载完成)  │
└──────┬──────┘
       │ onPageFinished
       ▼
┌─────────────┐
│   Visible   │ ──▶ 页面可见，JSBridge 就绪
│  (交互就绪)  │
└──────┬──────┘
       │ onPause / onResume
       ▼
┌─────────────┐
│  Destroyed  │ ──▶ 清理资源，取消请求
│  (销毁清理)  │
└─────────────┘
```

### Android 生命周期实现

```kotlin
class WebViewActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var isDestroyed = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = findViewById(R.id.webView)
        setupWebView()
        loadUrl(intent.getStringExtra("url")!!)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        // 通知 JS 页面可见
        webView.evaluateJavascript("window.dispatchEvent(new Event('app:resume'))", null)
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.evaluateJavascript("window.dispatchEvent(new Event('app:pause'))", null)
    }

    override fun onDestroy() {
        isDestroyed = true
        // 取消所有未完成的请求
        (webView as? BridgeWebView)?.cancelAllRequests()
        // 从父视图移除，防止内存泄漏
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    // 返回键处理
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }
}
```

## 3. JS 注入时机

```javascript
// 在 WebView 加载完成后注入基础能力
(function() {
  'use strict';

  // 标记容器环境
  window.__container__ = {
    platform: '${PLATFORM}',      // ios / android
    version: '${APP_VERSION}',
    containerVersion: '${CONTAINER_VERSION}',
    userAgent: navigator.userAgent,
  };

  // 注入 Bridge
  if (!window.JSBridge) {
    window.JSBridge = new NativeBridge();
  }

  // 注入登录态
  window.__auth__ = {
    token: '${ACCESS_TOKEN}',
    refreshToken: '${REFRESH_TOKEN}',
    expiresAt: ${EXPIRES_AT},
  };

  // 通知 H5 容器就绪
  window.dispatchEvent(new CustomEvent('container:ready', {
    detail: window.__container__
  }));
})();
```

## 4. 导航栏联动

```typescript
// H5 通过 JSBridge 控制原生导航栏
interface NavigationBarOptions {
  title?: string;
  titleColor?: string;
  backgroundColor?: string;
  leftButtons?: NavButton[];
  rightButtons?: NavButton[];
  immersive?: boolean;          // 沉浸式状态栏
}

// 使用示例
bridge.invoke('navigation', 'setTitle', { title: '商品详情' });

bridge.invoke('navigation', 'setRightButtons', {
  buttons: [
    {
      id: 'share',
      icon: 'share_icon',
      action: () => shareProduct(),
    },
  ],
});

// 监听导航栏按钮点击
bridge.on('navigation:rightButtonClick', (event) => {
  if (event.buttonId === 'share') {
    shareProduct();
  }
});
```
