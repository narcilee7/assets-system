# ML 运行时

## 1. 三大运行时对比

| 维度 | TensorFlow.js | ONNX Runtime Web | Transformers.js |
|------|--------------|------------------|-----------------|
| **定位** | 完整 ML 框架 | 通用推理引擎 | HuggingFace 模型专用 |
| **模型来源** | TF/Keras 转换 | PyTorch/TF/ONNX 导出 | HuggingFace Hub |
| **后端** | WebGL/WebGPU/WASM | WebGL/WebGPU/WASM | WASM (ONNX Runtime) |
| **包体积** | ~300KB (core) | ~200KB | ~1MB+ (含 tokenizer) |
| **易用性** | 中（需懂 TF） | 中（需模型转换） | 高（直接下载模型） |
| **生态** | 丰富（官方模型库） | 极广（跨框架） | NLP/CV 模型极丰富 |
| **适用场景** | 自定义训练、CV | 跨框架部署 | 快速接入 SOTA 模型 |

## 2. TensorFlow.js

```javascript
// 安装
// npm install @tensorflow/tfjs @tensorflow/tfjs-backend-webgpu

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

// 设置后端（WebGPU > WebGL > WASM > CPU）
async function initBackend() {
  if (await tf.backend().getGPGPUContext) {
    console.log('Using WebGL backend');
  }

  // 优先尝试 WebGPU
  try {
    await tf.setBackend('webgpu');
    console.log('Using WebGPU backend');
  } catch {
    await tf.setBackend('webgl');
    console.log('Fallback to WebGL backend');
  }
}

// 加载预训练模型
async function loadModel() {
  // 从 URL 加载
  const model = await tf.loadLayersModel('https://example.com/model.json');

  // 从本地存储加载
  const localModel = await tf.loadLayersModel('localstorage://my-model');

  // 从 IndexedDB 加载
  const idbModel = await tf.loadLayersModel('indexeddb://my-model');

  return model;
}

// 推理
async function predict(model, imageElement) {
  // 预处理
  const tensor = tf.browser.fromPixels(imageElement)
    .resizeNearestNeighbor([224, 224])
    .toFloat()
    .expandDims()
    .div(255.0);

  // 推理
  const prediction = model.predict(tensor);
  const result = await prediction.data();

  // 清理内存
  tensor.dispose();
  prediction.dispose();

  return result;
}

// 保存模型
async function saveModel(model) {
  await model.save('downloads://my-model');      // 下载文件
  await model.save('localstorage://my-model');    // LocalStorage
  await model.save('indexeddb://my-model');       // IndexedDB（推荐）
}
```

## 3. ONNX Runtime Web

```javascript
// 安装
// npm install onnxruntime-web

import * as ort from 'onnxruntime-web';

// 配置 WASM 路径（如果需要）
ort.env.wasm.wasmPaths = {
  'ort-wasm-simd-threaded.wasm': '/path/to/ort-wasm-simd-threaded.wasm',
};

// 设置日志级别
ort.env.logLevel = 'warning';

async function runInference() {
  // 创建会话
  const session = await ort.InferenceSession.create(
    '/models/resnet50.onnx',
    {
      executionProviders: ['webgpu', 'webgl', 'wasm'],  // 优先级顺序
      graphOptimizationLevel: 'all',
    }
  );

  // 准备输入
  const inputData = new Float32Array(1 * 3 * 224 * 224);
  // ... 填充数据 ...

  const tensor = new ort.Tensor('float32', inputData, [1, 3, 224, 224]);

  // 运行推理
  const feeds = { input: tensor };
  const results = await session.run(feeds);

  // 获取输出
  const output = results.output;
  const data = output.data;

  // 清理
  tensor.dispose();
  session.release();

  return data;
}

// 在 Web Worker 中运行
// worker.js
self.onmessage = async (e) => {
  const { modelPath, inputData } = e.data;
  const session = await ort.InferenceSession.create(modelPath);
  const tensor = new ort.Tensor('float32', inputData);
  const results = await session.run({ input: tensor });
  self.postMessage({ result: results.output.data });
};
```

## 4. Transformers.js

```javascript
// 安装
// npm install @huggingface/transformers

import { pipeline, env } from '@huggingface/transformers';

// 配置（可选）
env.allowLocalModels = false;  // 不从本地文件系统加载
env.useBrowserCache = true;    // 使用浏览器缓存
env.useCache = true;           // 使用 Hub 缓存

// 文本分类
async function classifyText() {
  const classifier = await pipeline(
    'sentiment-analysis',
    'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    { dtype: 'q8' }  // 8-bit 量化
  );

  const result = await classifier('I love this product!');
  console.log(result);
  // [{ label: 'POSITIVE', score: 0.9998 }]
}

// 特征提取（Embedding）
async function extractEmbedding() {
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { dtype: 'fp16' }
  );

  const embedding = await extractor('Hello world', {
    pooling: 'mean',
    normalize: true,
  });

  return embedding.data;  // Float32Array(384)
}

// 文本生成
async function generateText() {
  const generator = await pipeline(
    'text-generation',
    'Xenova/tinyllama-chat-v1.0',
    { dtype: 'q4' }  // 4-bit 量化
  );

  const result = await generator('The future of AI is', {
    max_new_tokens: 50,
    temperature: 0.7,
    do_sample: true,
    top_k: 50,
    top_p: 0.9,
  });

  console.log(result[0].generated_text);
}

// 自动语音识别（ASR）
async function transcribeAudio(audioBlob) {
  const transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny'
  );

  const result = await transcriber(audioBlob, {
    language: 'zh',
    task: 'transcribe',
  });

  return result.text;
}
```

## 5. 运行时选型矩阵

| 场景 | 推荐运行时 | 理由 |
|------|-----------|------|
| 图像分类/检测 | TensorFlow.js / ONNX | TF.js 模型生态丰富 |
| NLP（文本分类/NER） | Transformers.js | 直接加载 HF 模型 |
| Embedding 生成 | Transformers.js | all-MiniLM 等模型开箱即用 |
| 跨框架部署 | ONNX Runtime | PyTorch/TF 统一转换 |
| 自定义模型 | TensorFlow.js | 支持训练和微调 |
| 语音识别 | Transformers.js | Whisper 模型直接可用 |
| 多模态 | Transformers.js | CLIP、LLaVA 等模型 |
