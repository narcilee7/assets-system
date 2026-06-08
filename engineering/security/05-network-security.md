# 网络安全

## 1. HTTPS / TLS

```
TLS 握手过程（TLS 1.3）

客户端                    服务端
  │                        │
  │── Client Hello ───────▶│  支持的密码套件、密钥共享
  │   + KeyShare           │
  │                        │
  │◀── Server Hello ───────│  选择的密码套件
  │   + EncryptedExtensions│
  │   + Certificate        │  证书 + 签名
  │   + Finished           │
  │                        │
  │── Finished ───────────▶│
  │                        │
  │══ 应用数据（加密）══════▶│

TLS 1.3 改进：
├── 1-RTT 握手（TLS 1.2 需要 2-RTT）
├── 0-RTT 会话恢复（有重放风险）
├── 移除不安全的算法（MD5、SHA1、RC4、DES）
├── 前向保密（Forward Secrecy）强制
└── 加密更多握手消息

证书类型：
├── DV（Domain Validated）：仅验证域名所有权
├── OV（Organization Validated）：验证组织身份
├── EV（Extended Validated）：最严格验证（绿色地址栏）
└── 自签名证书：内部测试使用
```

```nginx
# Nginx TLS 配置
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    # TLS 1.2/1.3 only
    ssl_protocols TLSv1.2 TLSv1.3;

    # 强密码套件
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 前向保密
    ssl_ecdh_curve X25519:secp384r1;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/ssl/certs/chain.pem;

    # Session 复用
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
}
```

## 2. CORS

```
CORS（跨源资源共享）

简单请求：
├── 方法：GET、HEAD、POST
├── Content-Type：text/plain、multipart/form-data、application/x-www-form-urlencoded
└── 自定义头受限

预检请求（Preflight）：
├── 复杂请求先发送 OPTIONS
├── 浏览器自动处理
└── 服务端需响应 Access-Control-Allow-*

安全要点：
├── ❌ 不要使用 Access-Control-Allow-Origin: *
├── ✅ 使用白名单验证 Origin
├── ✅ 限制允许的方法
├── ✅ 限制允许的请求头
├── ✅ 设置合理的 max-age
└── ✅ 凭证请求需明确设置 Access-Control-Allow-Credentials: true + 具体 Origin
```

```python
# FastAPI CORS
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = [
    "https://app.example.com",
    "https://admin.example.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    max_age=600,
)

# 手动检查 Origin（更严格）
@app.middleware("http")
async def check_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS:
        return Response("Invalid origin", status_code=403)
    return await call_next(request)
```

## 3. CSP（内容安全策略）

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://cdn.example.com 'nonce-abc123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
  report-uri /csp-report;

关键指令：
├── default-src：默认策略
├── script-src：JS 来源（最重要）
├── style-src：CSS 来源
├── img-src：图片来源
├── connect-src：XHR/fetch/WebSocket
├── frame-ancestors：防止点击劫持（替代 X-Frame-Options）
└── report-uri：违规报告收集
```

## 4. WAF 与 DDoS 防护

```
WAF（Web 应用防火墙）
├── 规则集：
│   ├── OWASP Core Rule Set (CRS)
│   ├── 自定义业务规则
│   └── IP 信誉
├── 部署位置：
│   ├── 云 WAF：Cloudflare、AWS WAF、阿里云 WAF
│   ├── 边缘 WAF：CDN 层
│   └── 本地 WAF：ModSecurity、OpenResty + Lua
└── 模式：
    ├── 检测模式：记录不阻断
    └── 阻断模式：直接拦截

DDoS 防护：
├── 容量耗尽型：
│   ├── CDN 吸收（Cloudflare、Akamai）
│   ├── Anycast 分散流量
│   └── 黑洞路由（紧急时丢弃流量）
├── 协议层攻击：
│   ├── SYN Flood：SYN Cookie、连接限制
│   └── UDP Flood：禁用 UDP 或限制速率
├── 应用层攻击：
│   ├── 速率限制（Rate Limiting）
│   ├── 挑战响应（CAPTCHA、JS Challenge）
│   └── 行为分析（Bot Management）
└── 慢速攻击：
    ├── Slowloris：超时设置
    └── Slow POST：请求体大小限制
```

```nginx
# Nginx 速率限制
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=addr:10m;

server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_conn addr 10;
        
        # 特定接口更严格
        location /api/login {
            limit_req zone=api burst=5 nodelay;
        }
    }
}
```
