# 手写 WASM 加载器

## 目标

实现一个简化版 WASM 加载器，支持：
1. 流式编译（边下载边编译）
2. 缓存（Cache API / IndexedDB）
3. 进度回调
4. 多实例管理

## 实现

```javascript
// wasm-loader.js

class WasmLoader {
  constructor(options = {}) {
    this.cacheName = options.cacheName || 'wasm-cache';
    this.maxCacheSize = options.maxCacheSize || 50 * 1024 * 1024; // 50MB
    this.instances = new Map();
  }

  // ========== 核心加载 API ==========

  async load(url, importObject = {}, options = {}) {
    const cacheKey = options.cacheKey || url;

    // 1. 检查内存缓存
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey);
    }

    // 2. 尝试从 Cache API 加载
    let wasmBytes = await this._loadFromCache(url);

    // 3. 网络下载
    if (!wasmBytes) {
      wasmBytes = await this._download(url, options.onProgress);
      await this._saveToCache(url, wasmBytes);
    }

    // 4. 编译并实例化
    const { instance, module } = await this._compile(wasmBytes, importObject, options);

    const result = { instance, module, exports: instance.exports };
    this.instances.set(cacheKey, result);

    return result;
  }

  async loadStreaming(url, importObject = {}, options = {}) {
    const cacheKey = options.cacheKey || url;

    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey);
    }

    // 检查 Cache API
    const cached = await this._loadFromCache(url);
    if (cached) {
      return this._compile(cached, importObject, options);
    }

    // 流式下载 + 编译
    const response = await fetch(url);
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    // 包装 response 以跟踪进度
    const trackedResponse = this._trackProgress(response, total, options.onProgress);

    // 流式编译（最优）
    const { instance, module } = await WebAssembly.instantiateStreaming(
      trackedResponse,
      importObject
    );

    // 保存到缓存
    if (module) {
      const bytes = await this._moduleToBytes(module);
      await this._saveToCache(url, bytes);
    }

    const result = { instance, module, exports: instance.exports };
    this.instances.set(cacheKey, result);

    return result;
  }

  // ========== 缓存管理 ==========

  async _loadFromCache(url) {
    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(url);
      if (response) {
        return new Uint8Array(await response.arrayBuffer());
      }
    } catch (e) {
      console.warn('Cache API not available:', e);
    }
    return null;
  }

  async _saveToCache(url, bytes) {
    try {
      const cache = await caches.open(this.cacheName);
      const response = new Response(bytes, {
        headers: {
          'Content-Type': 'application/wasm',
          'Content-Length': String(bytes.length),
        },
      });
      await cache.put(url, response);
    } catch (e) {
      console.warn('Failed to save to cache:', e);
    }
  }

  // ========== 下载与进度 ==========

  async _download(url, onProgress) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!onProgress || !total) {
      return new Uint8Array(await response.arrayBuffer());
    }

    // 手动读取以跟踪进度
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      received += value.length;
      onProgress(received, total);
    }

    // 合并 chunks
    const result = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  _trackProgress(response, total, onProgress) {
    if (!onProgress || !total) return response;

    const reader = response.body.getReader();
    let received = 0;

    const stream = new ReadableStream({
      start(controller) {
        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            received += value.length;
            onProgress(received, total);
            controller.enqueue(value);
            read();
          });
        }
        read();
      },
    });

    return new Response(stream, {
      headers: response.headers,
    });
  }

  // ========== 编译 ==========

  async _compile(bytes, importObject, options) {
    const compileMode = options.compileMode || 'async'; // async | sync | streaming

    if (compileMode === 'sync') {
      const module = new WebAssembly.Module(bytes);
      const instance = new WebAssembly.Instance(module, importObject);
      return { module, instance };
    }

    // 异步编译（默认）
    const module = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(module, importObject);
    return { module, instance };
  }

  // ========== 工具方法 ==========

  async _moduleToBytes(module) {
    // 从 Module 重建字节码（用于缓存）
    // 注意：这不是标准 API，实际应缓存原始 bytes
    // 这里简化处理：返回空（假设原始 bytes 已缓存）
    return null;
  }

  async clearCache() {
    try {
      await caches.delete(this.cacheName);
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
  }

  dispose(key) {
    if (key) {
      this.instances.delete(key);
    } else {
      this.instances.clear();
    }
  }
}

// ========== 使用示例 ==========

const loader = new WasmLoader({ cacheName: 'my-app-wasm' });

// 基础加载
const { instance, exports } = await loader.load('/wasm/image.wasm', {
  env: { memory: new WebAssembly.Memory({ initial: 10 }) },
});

// 流式加载 + 进度
const { exports: cryptoExports } = await loader.loadStreaming(
  '/wasm/crypto.wasm',
  {},
  {
    onProgress: (received, total) => {
      const percent = ((received / total) * 100).toFixed(1);
      console.log(`Loading: ${percent}%`);
    },
  }
);

module.exports = { WasmLoader };
```
