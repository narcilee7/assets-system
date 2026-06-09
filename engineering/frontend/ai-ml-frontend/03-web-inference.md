# Web 推理架构

## 1. 计算后端对比

| 后端 | 适用场景 | 性能 | 兼容性 | 启动时间 |
|------|---------|------|--------|---------|
| **WebGPU** | 大模型推理、并行计算 | 最高 | Chrome 113+ | 慢（需编译 shader） |
| **WebGL** | 中等模型、图像处理 | 高 | 广泛 | 中 |
| **WASM** | 小模型、通用推理 | 中 | 全部 | 快 |
| **WebNN** | 原生 AI 加速 | 极高 | 实验性 | 快 |

```javascript
// 后端自动选择
async function selectBestBackend() {
  // 1. 检查 WebGPU
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    } catch { /* ignore */ }
  }

  // 2. 检查 WebGL
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (gl) return 'webgl';

  // 3. 回退到 WASM
  return 'wasm';
}
```

## 2. WebGPU 推理

```javascript
// WebGPU 初始化
async function initWebGPU() {
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported');
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });

  if (!adapter) {
    throw new Error('No WebGPU adapter found');
  }

  const device = await adapter.requestDevice();
  return { adapter, device };
}

// 使用 ONNX Runtime + WebGPU
import * as ort from 'onnxruntime-web';

async function runWithWebGPU(modelUrl) {
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['webgpu'],
    preferredOutputLocation: 'gpu',  // 输出保持在 GPU 内存
  });

  // 输入数据可以直接是 GPUBuffer
  const inputTensor = new ort.Tensor('float32', inputData, [1, 3, 224, 224]);

  const start = performance.now();
  const results = await session.run({ input: inputTensor });
  const latency = performance.now() - start;

  console.log(`Inference latency: ${latency.toFixed(2)}ms`);

  return results;
}
```

## 3. Web Worker 推理

```javascript
// inference.worker.js
import * as ort from 'onnxruntime-web';

let session = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'LOAD_MODEL': {
      const { modelUrl, backend = 'wasm' } = payload;
      session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: [backend],
      });
      self.postMessage({ type: 'MODEL_LOADED' });
      break;
    }

    case 'INFERENCE': {
      if (!session) {
        self.postMessage({ type: 'ERROR', error: 'Model not loaded' });
        return;
      }

      const { inputData, inputShape, inputName = 'input' } = payload;
      const tensor = new ort.Tensor('float32', inputData, inputShape);

      const start = performance.now();
      const results = await session.run({ [inputName]: tensor });
      const latency = performance.now() - start;

      // 将结果传回主线程
      const outputName = Object.keys(results)[0];
      const outputData = results[outputName].data;

      self.postMessage({
        type: 'INFERENCE_RESULT',
        result: outputData,
        latency,
      }, [outputData.buffer]);  // Transfer ownership

      tensor.dispose();
      break;
    }

    case 'DISPOSE': {
      session?.release();
      session = null;
      self.postMessage({ type: 'DISPOSED' });
      break;
    }
  }
};

// main.js
const worker = new Worker(new URL('./inference.worker.js', import.meta.url), {
  type: 'module',
});

// 加载模型
worker.postMessage({
  type: 'LOAD_MODEL',
  payload: { modelUrl: '/models/model.onnx', backend: 'webgpu' },
});

worker.onmessage = (e) => {
  if (e.data.type === 'INFERENCE_RESULT') {
    console.log('Result:', e.data.result);
    console.log('Latency:', e.data.latency, 'ms');
  }
};

// 执行推理
function runInference(inputData, inputShape) {
  worker.postMessage({
    type: 'INFERENCE',
    payload: { inputData, inputShape },
  }, [inputData.buffer]);  // Transfer ownership to worker
}
```

## 4. 流式生成

```javascript
// LLM 流式生成（Transformers.js）
import { TextStreamer } from '@huggingface/transformers';

async function streamGeneration() {
  const generator = await pipeline(
    'text-generation',
    'Xenova/tinyllama-chat-v1.0',
    { dtype: 'q4' }
  );

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    callback_function: (token) => {
      // 每个 token 生成时回调
      appendToUI(token);
    },
  });

  await generator('Tell me a story about', {
    max_new_tokens: 100,
    streamer,
  });
}

// 自定义流式处理（分块解码）
class TokenStreamer {
  constructor(tokenizer, onToken) {
    this.tokenizer = tokenizer;
    this.onToken = onToken;
    this.tokens = [];
  }

  put(tokenIds) {
    this.tokens.push(...tokenIds);
    const text = this.tokenizer.decode(this.tokens, {
      skip_special_tokens: true,
    });
    this.onToken(text);
  }

  end() {
    const text = this.tokenizer.decode(this.tokens, {
      skip_special_tokens: true,
    });
    this.onToken(text, true);  // isFinal = true
  }
}
```

## 5. 性能监控

```javascript
class InferenceProfiler {
  constructor() {
    this.metrics = [];
  }

  async profile(fn, label) {
    const start = performance.now();
    const memoryBefore = performance.memory?.usedJSHeapSize;

    const result = await fn();

    const latency = performance.now() - start;
    const memoryAfter = performance.memory?.usedJSHeapSize;

    const metric = {
      label,
      latency,
      memoryDelta: memoryAfter ? (memoryAfter - memoryBefore) / 1048576 : null,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    return { result, metric };
  }

  report() {
    const avgLatency = this.metrics.reduce((s, m) => s + m.latency, 0) / this.metrics.length;
    const maxLatency = Math.max(...this.metrics.map((m) => m.latency));

    console.table(this.metrics);
    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Max latency: ${maxLatency.toFixed(2)}ms`);
  }
}

// 使用
const profiler = new InferenceProfiler();

const { result } = await profiler.profile(
  () => model.predict(input),
  'image-classification'
);

profiler.report();
```
