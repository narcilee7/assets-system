# HTTPS / TLS 工程化

## 1. HSTS（HTTP Strict Transport Security）

```http
# 强制浏览器始终使用 HTTPS
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# max-age: 缓存时间（秒），1年 = 31536000
# includeSubDomains: 包含所有子域名
# preload: 申请加入浏览器内置 HSTS 列表
```

```javascript
// Express 中间件
app.use((req, res, next) => {
  if (req.secure) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  next();
});

// 强制 HTTPS 重定向
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
```

## 2. 安全响应头合集

```http
# 完整安全头配置
X-Content-Type-Options: nosniff              # 禁止 MIME 嗅探
X-Frame-Options: DENY                        # 禁止 iframe 嵌入
X-XSS-Protection: 0                          # 禁用旧版 XSS 过滤器（CSP 替代）
Referrer-Policy: strict-origin-when-cross-origin  # 跨域时只发送 origin
Permissions-Policy: geolocation=(), microphone=(), camera=()  # 禁用敏感 API
Cross-Origin-Embedder-Policy: require-corp   # COEP
Cross-Origin-Opener-Policy: same-origin      # COOP
Cross-Origin-Resource-Policy: same-origin    # CORP
```

## 3. TLS 版本与证书

```javascript
// Node.js HTTPS 服务器配置
const https = require('https');

const server = https.createServer(
  {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt'),
    // 禁用旧版 TLS
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    // 强密码套件
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-CHACHA20-POLY1305',
    ].join(':'),
    honorCipherOrder: true,
  },
  app
);
```

```nginx
# Nginx SSL 配置
server {
  listen 443 ssl http2;
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  # TLS 版本
  ssl_protocols TLSv1.2 TLSv1.3;

  # 证书链
  ssl_trusted_certificate /path/to/chain.pem;

  # OCSP Stapling
  ssl_stapling on;
  ssl_stapling_verify on;

  # Session 复用
  ssl_session_timeout 1d;
  ssl_session_cache shared:SSL:50m;

  # HSTS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
}
```

## 4. 混合内容处理

```html
<!-- ❌ 错误：HTTPS 页面加载 HTTP 资源 -->
<script src="http://cdn.example.com/lib.js"></script>
<img src="http://example.com/image.jpg">

<!-- ✅ 正确：全部使用 HTTPS -->
<script src="https://cdn.example.com/lib.js"></script>
<img src="https://example.com/image.jpg">

<!-- ✅ 或协议相对 URL（不推荐，显式 HTTPS 更好） -->
<script src="//cdn.example.com/lib.js"></script>
```

```javascript
// CSP 自动升级 HTTP 请求
// Content-Security-Policy: upgrade-insecure-requests;
// 浏览器会自动将 http:// 改为 https://
```
