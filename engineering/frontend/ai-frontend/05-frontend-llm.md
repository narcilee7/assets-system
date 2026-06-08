# 端侧大模型

## 1. WebLLM

```typescript
// 在浏览器中运行 Llama、Phi、Gemma 等模型

import * as webllm from '@mlc-ai/web-llm';

class BrowserLLM {
  private engine: webllm.MLCEngine | null = null;
  private modelId: string;

  constructor(modelId = 'Llama-3.1-8B-Instruct-q4f32_1-MLC') {
    this.modelId = modelId;
  }

  async init(onProgress?: (progress: webllm.InitProgressReport) => void) {
    this.engine = await webllm.CreateMLCEngine(this.modelId, {
      initProgressCallback: onProgress,
    });
  }

  async chat(messages: webllm.ChatCompletionMessageParam[]) {
    if (!this.engine) throw new Error('Engine not initialized');

    const response = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
    });

    return response;
  }

  async *streamChat(messages: webllm.ChatCompletionMessageParam[]) {
    const response = await this.chat(messages);

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) yield content;
    }
  }
}

// React Hook
function useBrowserLLM(modelId?: string) {
  const [engine] = useState(() => new BrowserLLM(modelId));
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    engine.init((p) => {
      setProgress(p.progress);
      if (p.progress === 1) setReady(true);
    });
  }, [engine]);

  const generate = useCallback(async (prompt: string) => {
    setGenerating(true);
    const messages = [{ role: 'user', content: prompt }] as const;

    let result = '';
    for await (const chunk of engine.streamChat(messages)) {
      result += chunk;
    }

    setGenerating(false);
    return result;
  }, [engine]);

  return { ready, progress, generating, generate };
}
```

```tsx
// 组件
function LocalChat() {
  const { ready, progress, generating, generate } = useBrowserLLM();
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');

  if (!ready) {
    return <div>Loading model... {Math.round(progress * 100)}%</div>;
  }

  const handleSubmit = async () => {
    setMessages((prev) => [...prev, `User: ${input}`]);
    const response = await generate(input);
    setMessages((prev) => [...prev, `AI: ${response}`]);
    setInput('');
  };

  return (
    <div>
      {messages.map((m, i) => <p key={i}>{m}</p>)}
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSubmit} disabled={generating}>
        {generating ? 'Generating...' : 'Send'}
      </button>
    </div>
  );
}
```

## 2. Transformers.js

```typescript
// Hugging Face Transformers 的 JS 版本

import { pipeline, env } from '@xenova/transformers';

// 使用本地缓存或 CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

class TransformersPipeline {
  private tasks = new Map<string, any>();

  async loadTask(task: string, model?: string) {
    const key = `${task}:${model || 'default'}`;
    if (this.tasks.has(key)) return this.tasks.get(key);

    const pipe = await pipeline(task, model, {
      progress_callback: (p: any) => console.log(`${task}: ${(p.progress * 100).toFixed(1)}%`),
    });

    this.tasks.set(key, pipe);
    return pipe;
  }

  // 文本分类
  async classify(text: string) {
    const classifier = await this.loadTask('text-classification');
    return classifier(text);
  }

  // 命名实体识别
  async ner(text: string) {
    const extractor = await this.loadTask('token-classification', 'Xenova/bert-base-NER');
    return extractor(text);
  }

  // 文本生成
  async generate(prompt: string, options?: any) {
    const generator = await this.loadTask('text-generation', 'Xenova/gpt2');
    return generator(prompt, {
      max_new_tokens: 100,
      temperature: 0.7,
      ...options,
    });
  }

  // 文本嵌入
  async embed(text: string | string[]) {
    const embedder = await this.loadTask('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return embedder(text, { pooling: 'mean', normalize: true });
  }

  // 问答
  async answerQuestion(question: string, context: string) {
    const qa = await this.loadTask('question-answering');
    return qa(question, context);
  }

  // 摘要
  async summarize(text: string) {
    const summarizer = await this.loadTask('summarization');
    return summarizer(text, { max_length: 100 });
  }

  // 翻译
  async translate(text: string, targetLang: string) {
    const translator = await this.loadTask('translation', `Xenova/opus-mt-en-${targetLang}`);
    return translator(text);
  }
}

// 使用
const transformers = new TransformersPipeline();

// 嵌入（用于 RAG）
const embeddings = await transformers.embed('Hello world');
console.log(embeddings);  // Float32Array(384)
```

## 3. ONNX Runtime Web

```typescript
// 运行 ONNX 模型（适用于自定义模型）

import * as ort from 'onnxruntime-web';

class ONNXInference {
  private session: ort.InferenceSession | null = null;

  async loadModel(modelUrl: string) {
    this.session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['webgpu', 'wasm'],  // 优先 WebGPU
    });
  }

  async run(inputs: Record<string, ort.Tensor>) {
    if (!this.session) throw new Error('Model not loaded');
    return this.session.run(inputs);
  }
}

// 使用 WebGPU 加速
async function initWebGPU() {
  if (!navigator.gpu) {
    console.warn('WebGPU not supported, falling back to WASM');
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;

  const device = await adapter.requestDevice();
  return !!device;
}
```

## 4. 模型选择与加载策略

```typescript
// 模型配置
const MODEL_CONFIGS = {
  'llama-3.1-8b': {
    size: '4.5GB',
    quantized: 'q4f32',
    minRAM: '6GB',
    capabilities: ['chat', 'code', 'analysis'],
    provider: 'webllm',
  },
  'phi-3-mini': {
    size: '1.8GB',
    quantized: 'q4f16',
    minRAM: '3GB',
    capabilities: ['chat', 'light-analysis'],
    provider: 'webllm',
  },
  'gemma-2b': {
    size: '1.3GB',
    quantized: 'q4f32',
    minRAM: '2GB',
    capabilities: ['chat'],
    provider: 'webllm',
  },
  'all-minilm-l6': {
    size: '80MB',
    capabilities: ['embedding'],
    provider: 'transformers',
  },
};

// 自动选择模型
function selectModel(capability: string, availableRAM: number): string | null {
  for (const [name, config] of Object.entries(MODEL_CONFIGS)) {
    if (config.capabilities.includes(capability)) {
      const minRAM = parseInt(config.minRAM || '0');
      if (availableRAM >= minRAM) {
        return name;
      }
    }
  }
  return null;
}

// 渐进加载策略
async function progressiveLoad(modelId: string) {
  // 1. 检查缓存
  const cached = await caches.match(`/models/${modelId}`);
  if (cached) {
    return cached.arrayBuffer();
  }

  // 2. 流式下载
  const response = await fetch(`/models/${modelId}`);
  const reader = response.body?.getReader();

  if (!reader) throw new Error('Streaming not supported');

  const chunks: Uint8Array[] = [];
  let received = 0;
  const total = Number(response.headers.get('content-length'));

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;

    // 进度回调
    onProgress?.(received / total);
  }

  // 合并并缓存
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  await caches.open('model-cache').then((cache) => {
    cache.put(`/models/${modelId}`, new Response(buffer));
  });

  return buffer;
}
```
