# 网络栈

## 1. 从 URL 到页面

```
用户输入 https://example.com/page
  ↓
1. URL 解析 → protocol(https) + host(example.com) + path(/page)
  ↓
2. HSTS 检查 → 是否强制 HTTPS
  ↓
3. DNS 解析
   ├── 浏览器缓存
   ├── OS 缓存
   ├── 路由器缓存
   ├── ISP DNS
   └── 递归查询 → 根域名服务器 → TLD 服务器 → 权威 DNS
  ↓
4. TCP 连接（HTTPS 还需 TLS 握手）
   ├── TCP 三次握手
   ├── TLS 握手（1-RTT / 0-RTT with TLS 1.3）
   └── ALPN 协商（HTTP/2 vs HTTP/1.1）
  ↓
5. 发送 HTTP 请求
  ↓
6. 接收响应 → 解析 → 开始渲染
```

```javascript
// 查看连接信息
// Chrome DevTools → Network → 选中请求 → Timing 标签

// Resource Timing API
const entries = performance.getEntriesByType('resource');
entries.forEach((r) => {
  console.log(r.name, {
    dns: r.domainLookupEnd - r.domainLookupStart,
    tcp: r.connectEnd - r.connectStart,
    ssl: r.secureConnectionStart > 0 ? r.connectEnd - r.secureConnectionStart : 0,
    ttfb: r.responseStart - r.startTime,
    download: r.responseEnd - r.responseStart,
    total: r.duration,
  });
});

// Navigation Timing
const nav = performance.getEntriesByType('navigation')[0];
console.log({
  dns: nav.domainLookupEnd - nav.domainLookupStart,
  tcp: nav.connectEnd - nav.connectStart,
  ttfb: nav.responseStart - nav.startTime,
  domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
  loadComplete: nav.loadEventEnd - nav.startTime,
});
```

## 2. HTTP/2 与 HTTP/3

```
HTTP/1.1：
  ├── 队头阻塞（Head-of-Line Blocking）
  ├── 一个 TCP 连接一次只能处理一个请求
  ├── 6-8 个并行连接（浏览器限制）
  └── 大量请求 → 连接竞争

HTTP/2：
  ├── 二进制分帧层
  ├── 多路复用（一个连接多个流）
  ├── 头部压缩（HPACK）
  ├── 服务器推送（Server Push）
  └── 优先级和流控制

HTTP/3（QUIC）：
  ├── 基于 UDP
  ├── 内置 TLS 1.3
  ├── 0-RTT 连接建立
  ├── 连接迁移（IP 变化不影响）
  └── 解决 TCP 队头阻塞
```

```javascript
// 检查 HTTP 版本
// DevTools → Network → Protocol 列

// 服务器推送（HTTP/2）
// nginx 配置
// http2_push /critical.css;

// 前端链接预加载（替代方案）
<link rel="preload" href="/critical.js" as="script">
<link rel="preconnect" href="https://cdn.example.com">
<link rel="dns-prefetch" href="https://cdn.example.com">
```

## 3. 资源优先级

```
Chrome 资源优先级：

Highest（最高）
  ├── HTML 文档
  ├── CSS（阻塞渲染）
  └── 字体（阻塞文本渲染）

High（高）
  ├── 首屏图片
  ├── 可见 iframe
  └── fetch/XHR（同步）

Medium（中）
  ├── script（defer/async）
  ├── 非首屏图片
  └── 非可见 iframe

Low（低）
  ├── prefetch 资源
  └── 预加载的后续页面资源

Lowest（最低）
  └── 预读取（prerender）
```

```html
<!-- 优化资源加载顺序 -->

<!-- 1. 预连接（提前建立 TCP/TLS） -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- 2. DNS 预解析 -->
<link rel="dns-prefetch" href="https://api.example.com">

<!-- 3. 关键资源预加载 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.webp" as="image" type="image/webp">

<!-- 4. 下页预加载 -->
<link rel="prefetch" href="/next-page.html">
<link rel="prerender" href="/next-page.html">  <!-- 预渲染整个页面 -->

<!-- 5. 模块预加载 -->
<link rel="modulepreload" href="/app.js">
```

## 4. 缓存策略

```javascript
// 缓存控制头
// Cache-Control: max-age=31536000, immutable  // 永久缓存
// Cache-Control: no-cache                      // 每次验证
// Cache-Control: no-store                      // 不缓存

// 验证缓存
// ETag: "abc123"
// Last-Modified: Wed, 01 Jun 2024 00:00:00 GMT
// If-None-Match: "abc123" → 304 Not Modified

// Service Worker 缓存策略
const cacheStrategy = {
  // 静态资源：Cache First
  static: async (request) => {
    const cache = await caches.open('static-v1');
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  },

  // API 请求：Network First + 超时回退
  api: async (request, timeout = 3000) => {
    const cache = await caches.open('api-v1');

    try {
      const response = await Promise.race([
        fetch(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw new Error('Network and cache both failed');
    }
  },
};
```
