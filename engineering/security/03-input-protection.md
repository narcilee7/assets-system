# 输入防护

## 1. SQL 注入

```python
# ❌ 不安全的代码
query = f"SELECT * FROM users WHERE username = '{username}'"
# 输入：' OR '1'='1
# 结果：SELECT * FROM users WHERE username = '' OR '1'='1'

# ✅ 参数化查询
cursor.execute("SELECT * FROM users WHERE username = %s", (username,))

# ✅ ORM
def get_user(username):
    return User.query.filter_by(username=username).first()

# ✅ 存储过程（参数化）
cursor.callproc('sp_get_user', [username])
```

```python
# 高级防护：WAF 规则
SQL_INJECTION_PATTERNS = [
    r"(\%27)|(\')|(\-\-)|(\%23)|(#)",  # 单引号、注释
    r"((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))",  # =...'...
    r"\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))",  # 'OR
    r"((\%27)|(\'))union",  # 'union
    r"exec(\s|\+)+(s|x)p\w+",  # exec xp_
]
```

## 2. XSS（跨站脚本）

```
XSS 类型：
├── 反射型（Reflected）
│   ├── 恶意 URL 参数，用户点击触发
│   └── 示例：https://example.com/search?q=<script>alert(1)</script>
├── 存储型（Stored）
│   ├── 恶意脚本存入数据库，所有访问者触发
│   └── 示例：博客评论中插入 <script> 窃取 cookie
└── DOM 型（DOM-based）
    ├── 前端 JavaScript 处理不当导致
    └── 示例：location.hash 直接插入 DOM

防御策略：
├── 输出编码（Output Encoding）
│   ├── HTML 实体编码：`<` → `&lt;`, `>` → `&gt;`
│   ├── JavaScript 编码：`"` → `\x22`
│   ├── URL 编码：` ` → `%20`
│   └── CSS 编码：`<` → `\3c`
├── 内容安全策略（CSP）
│   └── Content-Security-Policy: default-src 'self'; script-src 'self'
├── HttpOnly Cookie
│   └── Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Strict
└── 输入验证 + 富文本消毒
    └── DOMPurify、Bleach
```

```javascript
// DOMPurify 消毒
import DOMPurify from 'dompurify';

const dirty = '<img src=x onerror="alert(1)">';
const clean = DOMPurify.sanitize(dirty);
// 输出: '<img src="x">'

// 后端消毒（Python Bleach）
import bleach

clean = bleach.clean(
    user_input,
    tags=['p', 'br', 'strong', 'em'],
    attributes={'a': ['href', 'title']},
    protocols=['http', 'https', 'mailto']
)
```

## 3. CSRF（跨站请求伪造）

```
攻击原理：
1. 用户已登录 bank.com，cookie 中有 session
2. 用户访问 attacker.com
3. attacker.com 中的表单自动提交到 bank.com/transfer
4. 浏览器自动携带 bank.com 的 cookie
5. 银行服务端误以为是用户本人操作

防御：
├── CSRF Token
│   ├── 服务端生成随机 token 嵌入表单
│   ├── 提交时验证 token
│   └── 攻击者无法获取 token（同源策略）
├── SameSite Cookie
│   ├── SameSite=Strict：完全禁止第三方携带
│   ├── SameSite=Lax：GET 请求允许，POST 禁止（默认）
│   └── SameSite=None; Secure：跨站需要，必须 HTTPS
├── 双重 Cookie
│   ├── 读取 Cookie 中的 token 放入请求头
│   └── 验证请求头中的 token 与 Cookie 一致
└── 自定义请求头
    └── XMLHttpRequest/fetch 添加自定义头，简单请求无法伪造
```

```python
# Flask-WTF CSRF 防护
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect(app)

# 前端
# <form method="POST">
#   <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
# </form>

# FastAPI 自定义
from fastapi import Request, HTTPException

@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        csrf_token = request.headers.get("X-CSRF-Token")
        cookie_token = request.cookies.get("csrf_token")
        if not csrf_token or not cookie_token or csrf_token != cookie_token:
            raise HTTPException(403, "CSRF token mismatch")
    return await call_next(request)
```

## 4. 命令注入与 SSRF

```python
# ❌ 命令注入
import os
os.system(f"ping {user_input}")
# 输入: "; rm -rf / #"
# 执行: ping ; rm -rf / #

# ✅ 使用参数列表（不经过 shell）
import subprocess
subprocess.run(["ping", "-c", "4", user_input], capture_output=True)

# ✅ 输入白名单
import re
if not re.match(r'^[a-zA-Z0-9.-]+$', user_input):
    raise ValueError("Invalid hostname")
subprocess.run(["ping", "-c", "4", user_input])
```

```python
# SSRF 防护
from urllib.parse import urlparse
import ipaddress

BLOCKED_SCHEMES = {'file', 'gopher', 'dict', 'ftp'}
BLOCKED_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0', '::1'}
PRIVATE_NETWORKS = [
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('169.254.0.0/16'),  # Link-local
    ipaddress.ip_network('::1/128'),
    ipaddress.ip_network('fc00::/7'),  # IPv6 private
]

def is_safe_url(url: str) -> bool:
    parsed = urlparse(url)
    
    # 1. 检查协议
    if parsed.scheme not in {'http', 'https'}:
        return False
    
    # 2. 检查主机名
    hostname = parsed.hostname
    if not hostname:
        return False
    
    if hostname.lower() in BLOCKED_HOSTS:
        return False
    
    # 3. 检查 IP
    try:
        ip = ipaddress.ip_address(hostname)
        for network in PRIVATE_NETWORKS:
            if ip in network:
                return False
    except ValueError:
        # 不是 IP，是域名
        pass
    
    # 4. DNS 解析后再次检查
    try:
        import socket
        resolved = socket.getaddrinfo(hostname, None)
        for _, _, _, _, sockaddr in resolved:
            ip = ipaddress.ip_address(sockaddr[0])
            for network in PRIVATE_NETWORKS:
                if ip in network:
                    return False
    except socket.gaierror:
        return False
    
    return True
```
