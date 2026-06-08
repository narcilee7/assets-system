# H5 登录态联动

## 三种登录态传递方案

### 方案 1：Cookie 同步（传统）

```kotlin
// Android CookieManager 同步
val cookieManager = CookieManager.getInstance()
cookieManager.setAcceptCookie(true)

// 登录成功后写入 Cookie
cookieManager.setCookie("https://example.com", "session_id=${token}; Path=/; Secure; HttpOnly")
cookieManager.setCookie("https://example.com", "user_id=${userId}; Path=/")

// 刷新 WebView Cookie
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
    cookieManager.flush()
}

// WebView 配置
webView.settings.apply {
    domStorageEnabled = true
    databaseEnabled = true
}
```

**问题**：
- iOS WKWebView Cookie 同步延迟（不是立即生效）
- Cookie 大小限制（~4KB）
- 跨域场景复杂

### 方案 2：Token 注入（推荐）

```kotlin
// 登录态通过 JS 注入
fun injectAuthToken(webView: WebView, auth: AuthState) {
    val js = """
        (function() {
            window.__auth__ = {
                token: '${auth.accessToken}',
                refreshToken: '${auth.refreshToken}',
                expiresAt: ${auth.expiresAt},
                user: ${JSONObject(auth.userProfile)},
            };
            window.dispatchEvent(new Event('auth:ready'));
        })();
    """.trimIndent()
    webView.evaluateJavascript(js, null)
}
```

```typescript
// H5 层封装
class AuthBridge {
  private token: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    // 等待容器注入
    if (window.__auth__) {
      this.token = window.__auth__.token;
    } else {
      window.addEventListener('auth:ready', () => {
        this.token = window.__auth__.token;
      });
    }
  }

  getToken(): string | null {
    return this.token;
  }

  // 带自动刷新的请求
  async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = await this.getValidToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      // Token 过期，刷新后重试
      this.token = null;
      const newToken = await this.getValidToken();
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      });
    }

    return response;
  }

  private async getValidToken(): Promise<string> {
    if (this.token && !this.isExpired()) {
      return this.token;
    }

    // 防止并发刷新
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  private isExpired(): boolean {
    const expiresAt = window.__auth__?.expiresAt;
    if (!expiresAt) return true;
    return Date.now() >= expiresAt - 60000; // 提前 60s 刷新
  }

  private async refreshToken(): Promise<string> {
    const result = await JSBridge.invoke('auth', 'refreshToken', {
      refreshToken: window.__auth__?.refreshToken,
    });
    this.token = result.token;
    window.__auth__.token = result.token;
    window.__auth__.expiresAt = result.expiresAt;
    return result.token;
  }
}
```

### 方案 3：SSO 统一登录

```
App 内登录态
    │
    │ 1. 登录成功
    ▼
┌─────────────┐
│  SSO Server  │──▶ 签发统一 Ticket
│  (认证中心)   │
└──────┬──────┘
       │ 2. 携带 Ticket 跳转 H5
       ▼
┌─────────────┐
│   H5 页面   │──▶ 用 Ticket 换 Token
│  (业务域名)  │
└─────────────┘
```

```typescript
// H5 页面启动时检查登录态
async function initAuth() {
  // 从 URL 参数获取 Ticket（SSO 跳转携带）
  const urlParams = new URLSearchParams(window.location.search);
  const ticket = urlParams.get('ticket');

  if (ticket) {
    // 用 Ticket 换取业务 Token
    const auth = await api.post('/auth/exchange', { ticket });
    localStorage.setItem('access_token', auth.token);
    // 清除 URL 中的 Ticket
    history.replaceState({}, '', window.location.pathname);
  }

  // 检查 Token 有效性
  const token = localStorage.getItem('access_token');
  if (!token || isTokenExpired(token)) {
    // 未登录，调用容器登录
    const result = await JSBridge.invoke('auth', 'login');
    localStorage.setItem('access_token', result.token);
  }
}
```

## 登录态一致性保障

| 场景 | 处理方案 |
|------|----------|
| App 退出登录 | 通过 JSBridge 事件通知 H5，H5 清除 localStorage 并刷新 |
| Token 过期 | H5 捕获 401，调用 JSBridge 刷新，失败则跳转登录页 |
| 多端登录冲突 | App 收到 kick 事件，同步给 H5，H5 弹窗提示并退出 |
| WebView 重建 | 每次 onResume 重新注入 __auth__，保证状态最新 |
