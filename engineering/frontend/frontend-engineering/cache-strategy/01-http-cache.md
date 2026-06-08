# HTTP Cache

## 1. Cache-Control 指令

```http
# 静态资源（构建产物带哈希）
Cache-Control: public, max-age=31536000, immutable
# 含义：任何缓存都可以存，1年不过期，文件内容不会变

# API 响应（短期缓存）
Cache-Control: private, max-age=60, stale-while-revalidate=300
# 含义：仅浏览器缓存，60秒内直接返回，300秒内允许 stale 同时后台更新

# 入口 HTML（永不缓存）
Cache-Control: no-cache
# 含义：每次使用都要验证（发条件请求）

# 敏感数据
Cache-Control: no-store
# 含义：完全不缓存
```

| 指令 | 作用 |
|------|------|
| `public` | 任何缓存（CDN、代理）都可以存 |
| `private` | 仅浏览器缓存 |
| `no-cache` | 可以存，但必须验证（发条件请求） |
| `no-store` | 完全不存 |
| `max-age` | 缓存有效期（秒） |
| `s-maxage` | CDN 专用 max-age（覆盖 max-age） |
| `immutable` | 文件内容永远不会变，不用验证 |
| `stale-while-revalidate` | 过期后允许返回 stale，同时后台更新 |

## 2. 条件请求（验证缓存）

```http
# 第一次请求
GET /app.js HTTP/1.1

HTTP/1.1 200 OK
Content-Type: application/javascript
ETag: "abc123"
Last-Modified: Wed, 01 Jun 2024 00:00:00 GMT
Cache-Control: max-age=3600

# 第二次请求（缓存过期后）
GET /app.js HTTP/1.1
If-None-Match: "abc123"
If-Modified-Since: Wed, 01 Jun 2024 00:00:00 GMT

HTTP/1.1 304 Not Modified
# 无响应体，节省带宽
```

## 3. CDN 缓存策略

```
用户请求 → CDN Edge → 源站

CDN 缓存层级：
Edge（边缘节点）→ Regional（区域节点）→ Origin（源站）

最佳实践：
1. 静态资源 → Edge 长期缓存 + 文件名哈希
2. HTML → Edge 不缓存（或极短 TTL），回源验证
3. API → Edge 视业务短期缓存或不缓存

Nginx 配置示例：
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Vary "Accept-Encoding";
}

location /index.html {
    expires -1;
    add_header Cache-Control "no-cache";
}
```

## 4. Vary 头

```http
# 根据 Accept-Encoding 分别缓存
Vary: Accept-Encoding
# 结果：gzip 和 br 分别有一份缓存

# 根据 Accept-Language 分别缓存（国际化站点）
Vary: Accept-Language
# ⚠️ 注意：Vary 太多会降低缓存命中率
```
