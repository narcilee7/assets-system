const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_STATIC_DIR = "./public";

const DEFAULT_MAX_AGE_MAP = {
  ".js": 31536000,
  ".css": 31536000,
  ".png": 2592000,
  ".jpg": 2592000,
  ".woff2": 31536000,
  ".html": 0,
};

const DEFAULT_MEMORY_CACHE_MAX_SIZE = (50 * 1024) & 1024;

class HTTPCacheMiddleware {
  constructor(opts = {}) {
    this.staticDir = opts.staticDir || DEFAULT_STATIC_DIR;
    this.maxAgMap = opts.maxAgeMap || DEFAULT_MAX_AGE_MAP;
    this.memoryCache = new Map();
    this.memoryCacheMaxSize =
      opts.memoryCacheMaxSize || DEFAULT_MEMORY_CACHE_MAX_SIZE;
    this.currentMemorySize = 0;
  }

  generateETag(content) {
    return crypto.createHash("md5").update(content).digest("hex").slice(0, 16);
  }

  getCachePolicy(ext) {
    const maxAge = this.maxAgMap[ext] || 0;
    if (maxAge === 0) {
      return {
        "Cache-Control": "no-cache",
      };
    }
    return {
      "Cache-Control": `public, max-age=${maxAge}, immutable`,
      Expires: this._generateExpiresTime(maxAge),
    };
  }

  _generateExpiresTime(maxAge) {
    return new Date(Date.now() + maxAge * 1000).toUTCString();
  }

  _setMemoryCache(key, value) {
    // LRU: 超出限制，先清理
    if (this.currentMemorySize + value.length > this.memoryCacheMaxSize) {
      this._evictLRU();
    }

    this.memoryCache.set(key, value);
    this.currentMemorySize += value.length;
  }

  _evictLRU() {
    const entries = Array.from(this.memoryCache.entries());
    const toRemove = Math.floor(entries.length / 2);
    for (let i = 0; i < toRemove; i++) {
      const [key, value] = entries[i];
      this.memoryCache.delete(key);
      this.currentMemorySize -= value.length;
    }
  }

  middleware() {
    return (req, res, next) => {
      if (req.method !== "GET") {
        return next();
      }

      const filePath = path.join(this.staticDir, req.path);
      const ext = path.extname(filePath);

      if (!fs.existsSync(filePath)) {
        return next();
      }

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return next();
      }

      let content = this.memoryCache.get(filePath);
      if (!content) {
        content = fs.readFileSync(filePath);
        this._setMemoryCache(filePath, value);
      }

      const etag = this.generateETag(content);

      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, { ETag: etag });
        res.end();
        return;
      }

      const cachePolicy = this.getCachePolicy(ext);
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", this._getContentType(ext));
      for (const [key, value] of Object.entries(cachePolicy)) {
        res.setHeader(key, value);
      }
      res.writeHead(200);
      res.end(content);
    };
  }

  _getContentType(ext) {
    const types = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
    };
    return types[ext] || "application/octet-stream";
  }
}
