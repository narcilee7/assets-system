# WASM 工具链

## 1. Rust + wasm-bindgen（推荐）

```rust
// Cargo.toml
// [dependencies]
// wasm-bindgen = "0.2"
// js-sys = "0.3"
// web-sys = { version = "0.3", features = ["console"] }

// src/lib.rs
use wasm_bindgen::prelude::*;

// 导出函数给 JS
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

// 导出结构体
#[wasm_bindgen]
pub struct ImageProcessor {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl ImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> ImageProcessor {
        ImageProcessor {
            width,
            height,
            data: vec![0; (width * height * 4) as usize],
        }
    }

    pub fn grayscale(&mut self) {
        for pixel in self.data.chunks_exact_mut(4) {
            let gray = (0.299 * pixel[0] as f32
                + 0.587 * pixel[1] as f32
                + 0.114 * pixel[2] as f32) as u8;
            pixel[0] = gray;
            pixel[1] = gray;
            pixel[2] = gray;
        }
    }

    pub fn data_ptr(&self) -> *const u8 {
        self.data.as_ptr()
    }
}

// 与 JS 异步交互
#[wasm_bindgen]
pub async fn fetch_data(url: String) -> Result<JsValue, JsValue> {
    let window = web_sys::window().unwrap();
    let resp = window.fetch_with_str(&url).await?;
    let json = resp.json()?.await?;
    Ok(json)
}
```

```bash
# 编译
wasm-pack build --target web

# 输出：
# pkg/
# ├── my_project.js       # JS 胶水代码
# ├── my_project_bg.wasm  # WASM 二进制
# ├── my_project.d.ts     # TypeScript 类型
# └── package.json

# JS 中使用
import init, { add, ImageProcessor } from './pkg/my_project.js';

await init();

console.log(add(1, 2));  // 3

const processor = new ImageProcessor(1920, 1080);
processor.grayscale();
```

## 2. AssemblyScript

```typescript
// 类似 TypeScript 的语法，编译到 WASM
// assembly/index.ts

export function add(a: i32, b: i32): i32 {
  return a + b;
}

export function factorial(n: i32): i32 {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// 数组操作
export function sumArray(arr: Float64Array): f64 {
  let sum: f64 = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}

// 字符串处理（通过内存）
export function concat(a: string, b: string): string {
  return a + b;
}
```

```bash
# 编译
asc assembly/index.ts --target release -o build/index.wasm

# JS 中使用
import { add, concat } from './build/index.js';

console.log(add(1, 2));
console.log(concat('Hello, ', 'WASM!'));
```

## 3. Emscripten（C/C++）

```c
// hello.c
#include <emscripten.h>
#include <stdio.h>

EMSCRIPTEN_KEEPALIVE
int add(int a, int b) {
    return a + b;
}

EMSCRIPTEN_KEEPALIVE
void greet(const char* name) {
    printf("Hello, %s!\n", name);
}

EMSCRIPTEN_KEEPALIVE
int* create_buffer(int size) {
    return (int*)malloc(size * sizeof(int));
}

EMSCRIPTEN_KEEPALIVE
void destroy_buffer(int* buffer) {
    free(buffer);
}
```

```bash
# 编译
emcc hello.c -o hello.js \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_add", "_greet", "_create_buffer", "_destroy_buffer"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
  -O3

# JS 中使用
<script src="hello.js"></script>
<script>
  Module.onRuntimeInitialized = function() {
    // 直接调用
    const result = Module.ccall('add', 'number', ['number', 'number'], [1, 2]);

    // 包装为 JS 函数
    const add = Module.cwrap('add', 'number', ['number', 'number']);
    console.log(add(5, 3));
  };
</script>
```

## 4. 工具链对比

| 工具链 | 语言 | 包体积 | JS 互操作 | 学习曲线 | 生态 |
|--------|------|--------|----------|---------|------|
| **Rust/wasm-bindgen** | Rust | 小 | 优秀 | 陡峭 | 最丰富 |
| **AssemblyScript** | TypeScript | 很小 | 良好 | 平缓 |  growing |
| **Emscripten** | C/C++ | 大 | 复杂 | 陡峭 | 成熟 |
| **TinyGo** | Go | 小 | 一般 | 平缓 | 有限 |
| **Javy** | JavaScript | 小 | N/A | 无 | 实验性 |

## 5. 构建优化

```bash
# Rust 优化
wasm-pack build --release --target web
# Cargo.toml: [profile.release] opt-level = 3, lto = true

# wasm-opt（Binaryen）进一步优化
wasm-opt -O3 -o output.wasm input.wasm

# 压缩
gzip -9 output.wasm        # 服务器自动
brotli -q 11 output.wasm   # 更好压缩比

# 代码分割（只加载需要的函数）
wasm-split --split-profile=profile.json -o split.wasm input.wasm
```
