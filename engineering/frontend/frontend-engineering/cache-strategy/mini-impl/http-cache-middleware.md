# 手写 HTTP 缓存中间件

## 目标

实现一个简化版 Node.js HTTP 缓存中间件，支持：
1. 根据文件类型自动设置 Cache-Control
2. ETag 生成与 304 响应
3. 内存缓存加速

## 实现

```javascript
// http-cache-middleware.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class HTTPCacheMiddleware {
  constructor(options = {}) {
    this.staticDir = options.staticDir || './public';
    this.maxAgeMap = options.maxAgeMap || {
      '.js': 31536000,
      '.css': 31536000,
      '.png': 2592000,
      '.jpg': 2592000,
      '.woff2': 31536000,
      '.html': 0,
    };
    this.memoryCache = new Map(); // 内存缓存
    this.memoryCacheMaxSize = options.memoryCacheMaxSize || 50 * 1024 * 1024; // 50MB
    this.currentMemorySize = 0;
  }

  // 生成 ETag
  generateETag(content) {
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 16);
  }

  // 获取缓存策略
  getCachePolicy(ext) {
    const maxAge = this.maxAgeMap[ext] || 0;
    if (maxAge === 0) {
      return { 'Cache-Control': 'no-cache' };
    }
    return {
      'Cache-Control': `public, max-age=${maxAge}, immutable`,
      'Expires': new Date(Date.now() + maxAge * 1000).toUTCString(),
    };
  }

  // 中间件主函数
  middleware() {
    return (req, res, next) => {
      if (req.method !== 'GET') return next();

      const filePath = path.join(this.staticDir, req.path);
      const ext = path.extname(filePath);

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) return next();

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return next();

      // 读取内容（优先内存缓存）
      let content = this.memoryCache.get(filePath);
      if (!content) {
        content = fs.readFileSync(filePath);
        this._setMemoryCache(filePath, content);
      }

      const etag = this.generateETag(content);

      // 检查 If-None-Match
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag });
        res.end();
        return;
      }

      // 设置响应头
      const cachePolicy = this.getCachePolicy(ext);
      res.setHeader('ETag', etag);
      res.setHeader('Content-Type', this._getContentType(ext));
      for (const [key, value] of Object.entries(cachePolicy)) {
        res.setHeader(key, value);
      }

      res.writeHead(200);
      res.end(content);
    };
  }

  _setMemoryCache(key, value) {
    // LRU：如果超出限制，先清理
    if (this.currentMemorySize + value.length > this.memoryCacheMaxSize) {
      this._evictLRU();
    }

    this.memoryCache.set(key, value);
    this.currentMemorySize += value.length;
  }

  _evictLRU() {
    // 简单实现：清理一半的缓存
    const entries = Array.from(this.memoryCache.entries());
    const toRemove = Math.floor(entries.length / 2);
    for (let i = 0; i < toRemove; i++) {
      const [key, value] = entries[i];
      this.memoryCache.delete(key);
      this.currentMemorySize -= value.length;
    }
  }

  _getContentType(ext) {
    const types = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.woff2': 'font/woff2',
    };
    return types[ext] || 'application/octet-stream';
  }
}

// 使用（Express 风格）
const http = require('http');
const cacheMiddleware = new HTTPCacheMiddleware({
  staticDir: './dist',
});

const server = http.createServer((req, res) => {
  const middleware = cacheMiddleware.middleware();

  // 模拟 Express 的 req/res/next
  req.path = req.url.split('?')[0];
  const next = () => {
    res.writeHead(404);
    res.end('Not Found');
  };

  middleware(req, res, next);
});

server.listen(3000, () => {
  console.log('Cache server running on port 3000');
});
```
