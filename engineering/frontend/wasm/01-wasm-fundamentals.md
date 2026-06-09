# WASM 基础

## 1. WASM 核心概念

```
WebAssembly 模块结构：

Module
  ├── Types（函数签名类型）
  ├── Imports（从宿主环境导入）
  │     ├── Functions
  │     ├── Memory
  │     ├── Tables
  │     └── Globals
  ├── Functions（函数定义）
  ├── Tables（函数指针表）
  ├── Memory（线性内存）
  ├── Globals（全局变量）
  ├── Exports（导出给宿主）
  │     ├── Functions
  │     ├── Memory
  │     ├── Tables
  │     └── Globals
  ├── Start（启动函数，可选）
  ├── Elements（表初始化）
  ├── Data（内存初始化）
  └── Custom Sections（调试信息等）
```

| 概念 | 说明 |
|------|------|
| **Module** | WASM 二进制单元，可实例化多次 |
| **Linear Memory** | 连续的、可增长的字节数组（ArrayBuffer） |
| **Table** | 函数引用数组，支持间接调用（函数指针） |
| **Stack Machine** | 基于栈的虚拟机（无寄存器） |
| **Value Types** | i32, i64, f32, f64, v128（SIMD）, funcref, externref |

## 2. 线性内存

```javascript
// WASM 内存是一个可增长的 ArrayBuffer
const memory = new WebAssembly.Memory({
  initial: 10,   // 初始 10 页（640KB）
  maximum: 100,  // 最大 100 页（6.4MB）
});

// 获取内存视图
const bytes = new Uint8Array(memory.buffer);

// WASM 中读写内存
// (module
//   (memory (export "mem") 1)
//   (func (export "getByte") (param $ptr i32) (result i32)
//     local.get $ptr
//     i32.load
//   )
//   (func (export "setByte") (param $ptr i32) (param $val i32)
//     local.get $ptr
//     local.get $val
//     i32.store
//   )
// )

// JS 中操作 WASM 内存
const wasm = await WebAssembly.instantiate(bytes, { env: { memory } });

// 在 WASM 内存中分配字符串
function writeString(memory, str, offset = 0) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const bytes = new Uint8Array(memory.buffer);
  bytes.set(data, offset);
  return data.length;
}

function readString(memory, offset, length) {
  const bytes = new Uint8Array(memory.buffer, offset, length);
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}
```

## 3. 实例化 WASM

```javascript
// 方式 1：同步编译（小模块）
const wasmModule = new WebAssembly.Module(wasmBytes);
const instance = new WebAssembly.Instance(wasmModule, importObject);

// 方式 2：异步编译（推荐）
const wasmModule = await WebAssembly.compile(wasmBytes);
const instance = await WebAssembly.instantiate(wasmModule, importObject);

// 方式 3：流式编译（最优，边下载边编译）
const response = await fetch('/module.wasm');
const wasmModule = await WebAssembly.compileStreaming(response);
const instance = await WebAssembly.instantiate(wasmModule, importObject);

// 方式 4：一步流式（最简洁）
const response = await fetch('/module.wasm');
const { instance, module } = await WebAssembly.instantiateStreaming(
  response,
  importObject
);

// 调用导出函数
const result = instance.exports.add(1, 2);
console.log(result); // 3
```

## 4. WAT（WebAssembly Text Format）

```wat
;; 简单的 WAT 示例
(module
  ;; 导入 JS 的 console.log
  (import "env" "log" (func $log (param i32)))

  ;; 定义内存
  (memory (export "mem") 1)

  ;; 全局变量
  (global $counter (mut i32) (i32.const 0))

  ;; 导出函数：加法
  (func (export "add") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add
  )

  ;; 导出函数：计数器
  (func (export "increment") (result i32)
    global.get $counter
    i32.const 1
    i32.add
    global.set $counter
    global.get $counter
  )

  ;; 数据段（初始化内存）
  (data (i32.const 0) "Hello, WASM!")
)
```

```javascript
// 加载上述 WAT
const wasmCode = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, // magic
  0x01, 0x00, 0x00, 0x00, // version
  // ... 二进制内容
]);

const importObject = {
  env: {
    log: (value) => console.log('WASM says:', value),
  },
};

const { instance } = await WebAssembly.instantiate(wasmCode, importObject);
console.log(instance.exports.add(5, 3));       // 8
console.log(instance.exports.increment());     // 1
console.log(instance.exports.increment());     // 2
```

## 5. WASI（WebAssembly System Interface）

```javascript
// WASI 让 WASM 可以访问文件系统、网络、时钟等系统资源
// Node.js 18+ 支持 WASI

import { WASI } from 'wasi';
import { argv, env } from 'node:process';
import { readFile } from 'node:fs/promises';

const wasi = new WASI({
  version: 'preview1',
  args: argv,
  env,
  preopens: {
    '/sandbox': '/some/real/path',
  },
});

const wasm = await WebAssembly.compile(
  await readFile(new URL('./program.wasm', import.meta.url))
);

const instance = await WebAssembly.instantiate(wasm, {
  wasi_snapshot_preview1: wasi.wasiImport,
});

wasi.start(instance);
```
