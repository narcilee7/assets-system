# JS/WASM 互操作

## 1. 基本互操作模式

```javascript
// 导入对象：WASM 调用 JS
const importObject = {
  env: {
    // 内存
    memory: new WebAssembly.Memory({ initial: 1 }),

    // 函数
    abort: () => { throw new Error('WASM abort'); },
    console_log: (ptr, len) => {
      const bytes = new Uint8Array(memory.buffer, ptr, len);
      console.log(new TextDecoder().decode(bytes));
    },

    // 时间
    now: () => Date.now(),
  },
};

// 导出对象：JS 调用 WASM
const { instance } = await WebAssembly.instantiate(module, importObject);
const exports = instance.exports;

// 调用 WASM 函数
const result = exports.compute(1000);

// 访问 WASM 内存
const memory = exports.memory;
const data = new Float64Array(memory.buffer, ptr, length);
```

## 2. 内存管理策略

```javascript
// 策略 1：WASM 分配，JS 读取
// WASM 提供 malloc/free
class WasmMemory {
  constructor(instance) {
    this.instance = instance;
    this.memory = instance.exports.memory;
  }

  malloc(size) {
    return this.instance.exports.malloc(size);
  }

  free(ptr) {
    this.instance.exports.free(ptr);
  }

  // 写入字符串
  writeString(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const ptr = this.malloc(bytes.length + 1);
    const view = new Uint8Array(this.memory.buffer);
    view.set(bytes, ptr);
    view[ptr + bytes.length] = 0;  // null terminator
    return { ptr, length: bytes.length };
  }

  // 读取字符串
  readString(ptr, maxLen = 1024) {
    const view = new Uint8Array(this.memory.buffer);
    let end = ptr;
    while (end < ptr + maxLen && view[end] !== 0) end++;
    const bytes = view.slice(ptr, end);
    return new TextDecoder().decode(bytes);
  }

  // 写入数组
  writeArray(data, Type = Float64Array) {
    const bytesPerElement = Type.BYTES_PER_ELEMENT;
    const ptr = this.malloc(data.length * bytesPerElement);
    const view = new Type(this.memory.buffer, ptr, data.length);
    view.set(data);
    return ptr;
  }
}

// 策略 2：JS 分配，WASM 使用
// 适用于已知大小的数据
function processImage(wasm, imageData) {
  const inputPtr = wasm.malloc(imageData.length);
  new Uint8Array(wasm.memory.buffer).set(imageData, inputPtr);

  const outputPtr = wasm.exports.process_image(inputPtr, imageData.length);

  const result = new Uint8Array(wasm.memory.buffer, outputPtr, imageData.length);
  const output = new Uint8Array(result);  // 复制出来

  wasm.free(inputPtr);
  wasm.free(outputPtr);

  return output;
}
```

## 3. SharedArrayBuffer + Atomics

```javascript
// 多线程 WASM（需要 COOP/COEP）
// main.js
const sharedMemory = new WebAssembly.Memory({
  initial: 10,
  maximum: 100,
  shared: true,  // 关键！
});

const worker = new Worker('worker.js');
worker.postMessage({ memory: sharedMemory, start: 0, end: 1000 });

// worker.js
self.onmessage = (e) => {
  const { memory, start, end } = e.data;
  const data = new Float64Array(memory.buffer);

  for (let i = start; i < end; i++) {
    data[i] = heavyComputation(i);
  }

  // 通知主线程完成
  Atomics.store(new Int32Array(memory.buffer), 0, 1);
  Atomics.notify(new Int32Array(memory.buffer), 0);
};
```

## 4. 性能优化

```javascript
// 优化 1：避免频繁跨边界调用
// ❌ 每次处理一个像素
for (let i = 0; i < pixels.length; i++) {
  wasm.exports.process_pixel(i);  // 每次都有调用开销
}

// ✅ 批量处理
wasm.exports.process_pixels(ptr, pixels.length);  // 一次调用

// 优化 2：缓存内存视图
// ❌ 每次都创建新视图
function readData() {
  return new Float64Array(wasm.memory.buffer, ptr, len);  // 内存增长后失效
}

// ✅ 检查内存是否增长
function getMemoryView() {
  if (cachedBuffer !== wasm.memory.buffer) {
    cachedBuffer = wasm.memory.buffer;
    cachedView = new Float64Array(cachedBuffer, ptr, len);
  }
  return cachedView;
}

// 优化 3：使用 TypedArray 直接操作内存
// WASM 内存是 ArrayBuffer，可以直接用 TypedArray 操作
const pixels = new Uint8ClampedArray(wasm.memory.buffer, imagePtr, width * height * 4);
// 直接修改 pixels 就是修改 WASM 内存

// 优化 4：流式编译 + 缓存
async function loadWasmWithCache(url) {
  const cacheKey = `wasm:${url}`;

  // 检查 Cache API
  const cache = await caches.open('wasm-cache');
  let response = await cache.match(url);

  if (!response) {
    response = await fetch(url);
    await cache.put(url, response.clone());
  }

  return WebAssembly.instantiateStreaming(response, importObject);
}

// 优化 5：Web Worker 中运行 WASM
// 避免阻塞主线程
const wasmWorker = new Worker('wasm-worker.js');
wasmWorker.postMessage({ type: 'COMPUTE', data: largeArray }, [largeArray.buffer]);
```
