# 手写 JS/WASM 绑定生成器

## 目标

实现一个简化版绑定生成器，支持：
1. 自动生成 JS 包装函数
2. 类型转换（基本类型 + 字符串 + 数组）
3. 内存分配/释放自动管理

## 实现

```javascript
// wasm-bindings.js

class WasmBindings {
  constructor(instance) {
    this.instance = instance;
    this.exports = instance.exports;
    this.memory = this.exports.memory;
    this.encoders = new TextEncoder();
    this.decoders = new TextDecoder();
  }

  // ========== 内存管理 ==========

  malloc(size) {
    if (this.exports.malloc) {
      return this.exports.malloc(size);
    }
    throw new Error('WASM module does not export malloc');
  }

  free(ptr) {
    if (this.exports.free) {
      this.exports.free(ptr);
    }
  }

  // ========== 类型转换 ==========

  writeString(str, ptr = null) {
    const bytes = this.encoders.encode(str + '\0');
    if (ptr === null) {
      ptr = this.malloc(bytes.length);
    }
    const view = new Uint8Array(this.memory.buffer);
    view.set(bytes, ptr);
    return { ptr, length: bytes.length - 1 };
  }

  readString(ptr, maxLength = 1024) {
    const view = new Uint8Array(this.memory.buffer);
    let end = ptr;
    const max = Math.min(ptr + maxLength, view.length);
    while (end < max && view[end] !== 0) end++;
    return this.decoders.decode(view.slice(ptr, end));
  }

  writeArray(data, type = 'f64') {
    const TypeMap = {
      i8: Int8Array,
      u8: Uint8Array,
      i16: Int16Array,
      u16: Uint16Array,
      i32: Int32Array,
      u32: Uint32Array,
      f32: Float32Array,
      f64: Float64Array,
    };

    const ArrayType = TypeMap[type];
    const bytesPerElement = ArrayType.BYTES_PER_ELEMENT;
    const ptr = this.malloc(data.length * bytesPerElement);
    const view = new ArrayType(this.memory.buffer, ptr, data.length);

    if (Array.isArray(data)) {
      view.set(data);
    } else {
      view.set(data);
    }

    return ptr;
  }

  readArray(ptr, length, type = 'f64') {
    const TypeMap = {
      i8: Int8Array,
      u8: Uint8Array,
      i16: Int16Array,
      u16: Uint16Array,
      i32: Int32Array,
      u32: Uint32Array,
      f32: Float32Array,
      f64: Float64Array,
    };

    const ArrayType = TypeMap[type];
    return new ArrayType(this.memory.buffer, ptr, length);
  }

  // ========== 函数包装器 ==========

  wrapFunction(name, signature) {
    const fn = this.exports[name];
    if (!fn) throw new Error(`Function ${name} not found in WASM exports`);

    return (...args) => {
      const wasmArgs = [];
      const toFree = [];

      try {
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          const type = signature.args[i];

          if (type === 'string') {
            const { ptr } = this.writeString(arg);
            wasmArgs.push(ptr);
            toFree.push(ptr);
          } else if (type.startsWith('array:')) {
            const elemType = type.split(':')[1];
            const ptr = this.writeArray(arg, elemType);
            wasmArgs.push(ptr);
            wasmArgs.push(arg.length);
            toFree.push(ptr);
          } else {
            wasmArgs.push(arg);
          }
        }

        const result = fn(...wasmArgs);

        // 处理返回值
        if (signature.return === 'string') {
          const str = this.readString(result);
          this.free(result);  // 假设 WASM 返回的字符串需要释放
          return str;
        }

        return result;
      } finally {
        for (const ptr of toFree) {
          this.free(ptr);
        }
      }
    };
  }

  // ========== 自动生成绑定 ==========

  generateBindings(exportsMetadata) {
    const bindings = {};

    for (const [name, meta] of Object.entries(exportsMetadata)) {
      if (meta.type === 'function') {
        bindings[name] = this.wrapFunction(name, {
          args: meta.args || [],
          return: meta.return || 'void',
        });
      }
    }

    return bindings;
  }
}

// ========== 使用示例 ==========

// 假设有以下 WASM 模块：
// - add(a: i32, b: i32) -> i32
// - greet(name: *const u8) -> *const u8
// - sum_array(data: *const f64, len: i32) -> f64

const wasm = await WebAssembly.instantiateStreaming(
  fetch('/math.wasm'),
  { env: { memory: new WebAssembly.Memory({ initial: 1 }) } }
);

const bindings = new WasmBindings(wasm.instance);

// 生成绑定
const api = bindings.generateBindings({
  add: { type: 'function', args: ['i32', 'i32'], return: 'i32' },
  greet: { type: 'function', args: ['string'], return: 'string' },
  sum_array: { type: 'function', args: ['array:f64', 'i32'], return: 'f64' },
});

// 使用
console.log(api.add(5, 3));  // 8
console.log(api.greet('World'));  // Hello, World!
console.log(api.sum_array([1.0, 2.0, 3.0, 4.0]));  // 10.0

module.exports = { WasmBindings };
```
