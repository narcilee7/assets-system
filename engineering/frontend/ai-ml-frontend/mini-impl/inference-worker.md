# 手写 Web Worker 推理引擎

## 目标

实现一个生产级 Web Worker 推理引擎，支持：
1. 模型加载与缓存
2. 推理队列（避免并发冲突）
3. 进度回调
4. 内存管理
5. 错误处理

## 实现

```javascript
// inference-engine.worker.js

class InferenceEngine {
  constructor() {
    this.session = null;
    this.modelUrl = null;
    this.isLoading = false;
    this.queue = [];
    this.isProcessing = false;
    this.cache = new Map();  // 输入指纹 → 结果缓存
  }

  async loadModel(modelUrl, options = {}) {
    if (this.modelUrl === modelUrl && this.session) {
      return { status: 'already_loaded' };
    }

    if (this.isLoading) {
      return { status: 'loading' };
    }

    this.isLoading = true;
    this.modelUrl = modelUrl;

    try {
      // 动态导入 ONNX Runtime（避免主线程加载）
      const ort = await import('onnxruntime-web');

      // 配置 WASM 路径
      if (options.wasmPaths) {
        ort.env.wasm.wasmPaths = options.wasmPaths;
      }

      // 创建会话
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: options.backends || ['wasm'],
        graphOptimizationLevel: 'all',
        ...options.sessionOptions,
      });

      this.isLoading = false;
      return { status: 'loaded', inputNames: this.session.inputNames, outputNames: this.session.outputNames };
    } catch (error) {
      this.isLoading = false;
      this.session = null;
      throw error;
    }
  }

  async run(inputData, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        inputData,
        options,
        resolve,
        reject,
      });

      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    if (!this.session) {
      throw new Error('Model not loaded');
    }

    this.isProcessing = true;
    const { inputData, options, resolve, reject } = this.queue.shift();

    try {
      // 检查缓存
      const cacheKey = options.cacheKey || this._computeCacheKey(inputData);
      if (options.useCache !== false && this.cache.has(cacheKey)) {
        resolve(this.cache.get(cacheKey));
        this.isProcessing = false;
        this._processQueue();
        return;
      }

      // 准备输入
      const feeds = {};
      for (const [name, tensorData] of Object.entries(inputData)) {
        const { data, shape, type = 'float32' } = tensorData;
        const ort = await import('onnxruntime-web');
        feeds[name] = new ort.Tensor(type, data, shape);
      }

      // 执行推理
      const startTime = performance.now();
      const results = await this.session.run(feeds);
      const inferenceTime = performance.now() - startTime;

      // 提取结果
      const output = {};
      for (const [name, tensor] of Object.entries(results)) {
        output[name] = {
          data: tensor.data,
          shape: tensor.dims,
          type: tensor.type,
        };
      }

      const result = {
        output,
        inferenceTime,
        modelName: this.modelUrl,
      };

      // 缓存结果
      if (options.useCache !== false) {
        this.cache.set(cacheKey, result);
        // LRU：限制缓存大小
        if (this.cache.size > 100) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }

      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      // 继续处理队列
      setTimeout(() => this._processQueue(), 0);
    }
  }

  _computeCacheKey(inputData) {
    // 简化版：使用输入数据的哈希
    return JSON.stringify(inputData);
  }

  dispose() {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
    this.cache.clear();
    this.queue = [];
  }
}

// Worker 消息处理
const engine = new InferenceEngine();

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;

  try {
    switch (type) {
      case 'LOAD_MODEL': {
        const result = await engine.loadModel(payload.modelUrl, payload.options);
        self.postMessage({ id, type: 'SUCCESS', result });
        break;
      }

      case 'RUN': {
        const result = await engine.run(payload.inputData, payload.options);
        self.postMessage({ id, type: 'SUCCESS', result });
        break;
      }

      case 'DISPOSE': {
        engine.dispose();
        self.postMessage({ id, type: 'SUCCESS', result: 'disposed' });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: error.message,
      stack: error.stack,
    });
  }
};
```

```javascript
// inference-client.js（主线程）

class InferenceWorkerClient {
  constructor(workerUrl) {
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.pendingRequests = new Map();
    this.messageId = 0;

    this.worker.onmessage = (e) => {
      const { id, type, result, error } = e.data;
      const request = this.pendingRequests.get(id);
      if (!request) return;

      this.pendingRequests.delete(id);

      if (type === 'SUCCESS') {
        request.resolve(result);
      } else {
        request.reject(new Error(error));
      }
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
    };
  }

  _send(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  loadModel(modelUrl, options) {
    return this._send('LOAD_MODEL', { modelUrl, options });
  }

  run(inputData, options) {
    return this._send('RUN', { inputData, options });
  }

  dispose() {
    return this._send('DISPOSE', {}).finally(() => {
      this.worker.terminate();
    });
  }
}

// 使用
const inference = new InferenceWorkerClient(
  new URL('./inference-engine.worker.js', import.meta.url)
);

await inference.loadModel('/models/classifier.onnx', {
  backends: ['webgpu', 'wasm'],
});

const result = await inference.run({
  input: {
    data: new Float32Array([/* ... */]),
    shape: [1, 3, 224, 224],
  },
});

console.log('Inference time:', result.inferenceTime, 'ms');
console.log('Output:', result.output);
```
