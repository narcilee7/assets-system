# JSBridge 简化实现

## 从 URL Scheme 到 MessageChannel

### 1. 第一代：URL Scheme

最早期的 JSBridge 通过 **iframe.src** 发送消息：

```javascript
// JS 调用 Native
function callNativeByURLScheme(module, action, params) {
  const scheme = `jsbridge://${module}/${action}?${encodeURIComponent(JSON.stringify(params))}`;
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = scheme;
  document.body.appendChild(iframe);
  setTimeout(() => document.body.removeChild(iframe), 100);
}

// 缺陷：
// 1. URL 长度限制（~2KB）
// 2. 无回调机制
// 3. 频繁创建 iframe 性能差
// 4. 消息丢失风险高
```

### 2. 第二代：Prompt / Console 拦截

```javascript
// Android: WebChromeClient.onJsPrompt 拦截
// iOS: WKScriptMessageHandler

function callNativeByPrompt(module, action, params) {
  const message = JSON.stringify({ module, action, params });
  const result = window.prompt('JSBridge', message);
  return JSON.parse(result);
}

// 缺陷：
// 1. 同步阻塞 UI 线程
// 2. 大数据传输卡顿
// 3. 用户体验差（Prompt 有视觉闪烁）
```

### 3. 第三代：MessageChannel（现代方案）

```javascript
// 简化版现代 JSBridge 实现
class JSBridge {
  constructor() {
    this._callbackId = 0;
    this._callbacks = new Map();
    this._eventHandlers = new Map();

    // 注册全局接收器
    window._jsbridgeReceive = this._receive.bind(this);
  }

  // JS -> Native 调用
  invoke(module, action, params = {}) {
    return new Promise((resolve, reject) => {
      const callbackId = ++this._callbackId;
      const timeout = 30000; // 30s 超时

      // 注册回调
      this._callbacks.set(callbackId, { resolve, reject, timer: setTimeout(() => {
        this._callbacks.delete(callbackId);
        reject(new Error(`JSBridge timeout: ${module}.${action}`));
      }, timeout)});

      // 发送消息（平台适配）
      const message = JSON.stringify({
        callbackId,
        module,
        action,
        params,
      });

      if (window._jsbridgeNative) {
        // Android: JavaScriptInterface
        window._jsbridgeNative.postMessage(message);
      } else if (window.webkit?.messageHandlers?.jsbridge) {
        // iOS: WKScriptMessageHandler
        window.webkit.messageHandlers.jsbridge.postMessage(message);
      } else {
        reject(new Error('JSBridge not available'));
      }
    });
  }

  // Native -> JS 回调
  _receive(result) {
    const { callbackId, data, error } = result;
    const cb = this._callbacks.get(callbackId);
    if (!cb) return;

    clearTimeout(cb.timer);
    this._callbacks.delete(callbackId);

    if (error) {
      cb.reject(new Error(error.message));
    } else {
      cb.resolve(data);
    }
  }

  // 注册事件监听（Native 主动推送）
  on(event, handler) {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event).add(handler);
  }

  off(event, handler) {
    this._eventHandlers.get(event)?.delete(handler);
  }

  // Native 触发事件
  emit(event, data) {
    this._eventHandlers.get(event)?.forEach(h => {
      try { h(data); } catch (e) { console.error(e); }
    });
  }
}

// 全局单例
export const bridge = new JSBridge();
```

### 4. Android 原生端实现

```java
// Android WebView 配置
public class BridgeWebViewClient extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (url.startsWith("jsbridge://")) {
            handleBridgeURL(url);
            return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }
}

// JavaScriptInterface
public class JSBridgeInterface {
    private Handler mainHandler = new Handler(Looper.getMainLooper());

    @JavascriptInterface
    public void postMessage(String message) {
        try {
            JSONObject json = new JSONObject(message);
            String module = json.getString("module");
            String action = json.getString("action");
            JSONObject params = json.getJSONObject("params");
            int callbackId = json.getInt("callbackId");

            // 异步处理，结果通过 evaluateJavascript 回传
            handleNativeCall(module, action, params, result -> {
                mainHandler.post(() -> {
                    String js = String.format(
                        "window._jsbridgeReceive(%s)",
                        result.toString()
                    );
                    webView.evaluateJavascript(js, null);
                });
            });
        } catch (JSONException e) {
            Log.e("JSBridge", "Parse error", e);
        }
    }
}

// 注册
webView.addJavascriptInterface(new JSBridgeInterface(), "_jsbridgeNative");
```

### 5. iOS WKWebView 实现

```objc
// iOS WKScriptMessageHandler
@interface JSBridgeHandler : NSObject <WKScriptMessageHandler>
@property (nonatomic, weak) WKWebView *webView;
@end

@implementation JSBridgeHandler

- (void)userContentController:(WKUserContentController *)userContentController
      didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.name isEqualToString:@"jsbridge"]) return;

    NSDictionary *body = message.body;
    NSNumber *callbackId = body[@"callbackId"];
    NSString *module = body[@"module"];
    NSString *action = body[@"action"];

    // 处理原生调用
    [self handleNativeCall:module action:action params:body[@"params"] completion:^(NSDictionary *result) {
        NSMutableDictionary *response = [NSMutableDictionary dictionaryWithDictionary:result];
        response[@"callbackId"] = callbackId;

        NSString *js = [NSString stringWithFormat:@"window._jsbridgeReceive(%@)",
                        [self jsonString:response]];

        dispatch_async(dispatch_get_main_queue(), ^{
            [self.webView evaluateJavaScript:js completionHandler:nil];
        });
    }];
}

@end

// 注册
WKUserContentController *controller = webView.configuration.userContentController;
[controller addScriptMessageHandler:bridgeHandler name:@"jsbridge"];
```

## 回调生命周期管理

```javascript
// 防止组件卸载后回调仍然执行
class BridgeCallManager {
  constructor() {
    this._activeCalls = new Map(); // callbackId -> { componentId, abort }
  }

  register(componentId, callbackId, abort) {
    this._activeCalls.set(callbackId, { componentId, abort });
  }

  // 组件卸载时取消所有相关调用
  cancelByComponent(componentId) {
    this._activeCalls.forEach((call, callbackId) => {
      if (call.componentId === componentId) {
        call.abort();
        this._activeCalls.delete(callbackId);
      }
    });
  }
}
```
