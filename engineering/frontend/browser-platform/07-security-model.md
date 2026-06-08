# 安全模型

## 1. 同源策略（Same-Origin Policy）

```
同源定义：protocol + host + port 完全相同

https://example.com:443/page
  ├── ✅ https://example.com:443/other  （同源）
  ├── ❌ http://example.com:443/page    （协议不同）
  ├── ❌ https://api.example.com/page   （主机不同）
  └── ❌ https://example.com:8080/page  （端口不同）

限制范围：
  ├── Cookie、LocalStorage、IndexedDB 读取
  ├── DOM 操作（iframe 跨域）
  ├── AJAX/fetch 跨域请求
  └── Canvas 读取跨域图片数据
```

```javascript
// 跨域解决方案

// 1. CORS（服务器授权）
// 响应头：
// Access-Control-Allow-Origin: https://example.com
// Access-Control-Allow-Methods: GET, POST
// Access-Control-Allow-Headers: Content-Type
// Access-Control-Allow-Credentials: true
// Access-Control-Max-Age: 86400

// 2. 预检请求（Preflight）
// 对于非简单请求（PUT/DELETE/自定义头）：
// OPTIONS /api/data HTTP/1.1
// Origin: https://example.com
// Access-Control-Request-Method: PUT

// 3. 前端 withCredentials
fetch('/api/data', {
  credentials: 'include',  // 发送跨域 Cookie
});

// 4. JSONP（已废弃，不安全）
```

## 2. 沙箱机制

```
Renderer Process 沙箱：
  ├── 系统调用过滤（seccomp-bpf / Windows token）
  ├── 文件系统访问限制（只能通过 IPC 请求 Browser Process）
  ├── 网络访问限制（Renderer 不直接发起网络请求）
  └── 内存隔离（每个 Renderer 独立地址空间）

iframe 沙箱：
  └── <iframe sandbox="...">
```

```html
<!-- iframe 沙箱 -->
<iframe
  src="https://untrusted.com/embed"
  sandbox="allow-scripts allow-same-origin"
  <!-- allow-scripts: 允许执行 JS -->
  <!-- allow-same-origin: 允许同源（谨慎使用） -->
  <!-- allow-popups: 允许打开弹窗 -->
  <!-- allow-forms: 允许提交表单 -->
></iframe>

<!-- 最严格：仅显示，无任何权限 -->
<iframe src="..." sandbox=""></iframe>
```

## 3. Content Security Policy

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-abc123' https://cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

```javascript
// CSP 违规报告
// report-uri /csp-report

// 收集报告
app.post('/csp-report', (req, res) => {
  const report = req.body['csp-report'];
  console.warn('CSP Violation:', {
    documentUri: report['document-uri'],
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
  });
  res.status(204).end();
});
```

## 4. Spectre / Meltdown 防护

```
Spectre 攻击原理：
  ├── 利用 CPU 分支预测和乱序执行
  ├── 通过时间测量推断缓存中的敏感数据
  └── 跨站 iframe 可以读取同源内存

浏览器防护：
  ├── Site Isolation（不同站点不同进程）
  ├── Cross-Origin Read Blocking (CORB)
  ├── Cross-Origin-Opener-Policy
  ├── Cross-Origin-Embedder-Policy
  └── SharedArrayBuffer 限制（需跨域隔离）
```

```http
# 启用跨域隔离（防御 Spectre）
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin

# 效果：
# 1. 页面获得独立进程
# 2. 可以安全使用 SharedArrayBuffer
# 3. 阻止跨窗口引用（防止 Spectre 侧信道）
```

```javascript
// 检查跨域隔离状态
if (self.crossOriginIsolated) {
  // 可以安全使用 SharedArrayBuffer
  const shared = new SharedArrayBuffer(1024);
} else {
  // 降级方案
  const buffer = new ArrayBuffer(1024);
}

// COOP/COEP 报告
// Reporting-API: {
//   "coop": [{
//     "type": "coop",
//     "url": "/reports/coop",
//     "max_age": 86400
//   }]
// }
```

## 5. 安全响应头完整清单

```http
# 推荐安全配置
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; ...
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```
