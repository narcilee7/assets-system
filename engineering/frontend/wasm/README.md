# WebAssembly 工程化

WebAssembly 工程化训练 —— 达到"能在浏览器运行 WASM、能选择编译工具链、能优化 JS/WASM 互操作性能"的水平。

## 训练哲学

1. **WASM 不是替代 JS，而是补充**：计算密集型任务交给 WASM，UI 和 IO 留在 JS。
2. **工具链决定体验**：Rust 生态最成熟，AssemblyScript 对前端最友好。
3. **内存管理是难点**：WASM 的线性内存需要显式管理，与 JS 的 GC 世界不同。
4. **启动成本不可忽视**：WASM 模块下载和编译需要时间，需要优化加载策略。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-wasm-fundamentals.md](01-wasm-fundamentals.md) | WASM 基础：模块结构、线性内存、Table、导入/导出、WASI |
| [02-wasm-toolchain.md](02-wasm-toolchain.md) | 工具链：Rust/wasm-bindgen、AssemblyScript、Emscripten、TinyGo |
| [03-wasm-integration.md](03-wasm-integration.md) | JS/WASM 互操作：FFI、内存管理、SharedArrayBuffer、性能优化 |
| [04-wasm-use-cases.md](04-wasm-use-cases.md) | 应用场景：图像处理、音视频编解码、加密、游戏、科学计算 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/wasm-loader.md](mini-impl/wasm-loader.md) | 手写 WASM 加载器（流式编译 + 缓存） |
| [mini-impl/wasm-bindings.md](mini-impl/wasm-bindings.md) | 手写 JS/WASM 绑定生成器 |

## WASM 选型决策树

```
源语言？
  ├─ Rust → wasm-bindgen / wasm-pack（最成熟）
  ├─ C/C++ → Emscripten
  ├─ TypeScript → AssemblyScript
  ├─ Go → TinyGo
  └─ 其他 → 手写 WAT 或使用编译器

性能要求？
  ├─ 极致（游戏/仿真）→ Rust + WebGPU
  ├─ 高（图像/加密）→ Rust/C++
  └─ 一般（工具库）→ AssemblyScript

团队背景？
  ├─ 前端团队 → AssemblyScript
  ├─ Rust 团队 → wasm-bindgen
  └─ C++ 团队 → Emscripten
```
