# 浏览器平台工程化

浏览器平台工程化训练 —— 达到"理解浏览器架构、掌握渲染管线、能优化运行时性能"的水平。

## 训练哲学

1. **浏览器是你的运行时**：不理解浏览器，就无法写出高性能的前端代码。
2. **渲染管线是性能的核心**：每一次 reflow/repaint/composite 都有成本。
3. **事件循环是并发的本质**：宏任务、微任务、requestAnimationFrame 的调度决定了用户体验。
4. **内存管理是长期工程**：泄漏不会立即暴露，但会逐渐拖垮应用。

## 体系索引

| 文档 | 内容 |
|------|------|
| [01-browser-architecture.md](01-browser-architecture.md) | 浏览器架构：多进程模型、标签页隔离、进程通信、Site Isolation |
| [02-rendering-pipeline.md](02-rendering-pipeline.md) | 渲染管线：HTML解析→DOM→CSSOM→RenderTree→Layout→Paint→Composite |
| [03-js-engine.md](03-js-engine.md) | JS 引擎：V8 架构、Ignition+TurboFan 编译管道、隐藏类、内联缓存 |
| [04-event-loop.md](04-event-loop.md) | 事件循环：宏任务/微任务、任务优先级、rAF、rIC、调度策略 |
| [05-memory-management.md](05-memory-management.md) | 内存管理：堆栈结构、泄漏模式、Performance API、Memory Profiler |
| [06-network-stack.md](06-network-stack.md) | 网络栈：DNS、TCP/QUIC、HTTP/2/3、资源优先级、预加载策略 |
| [07-security-model.md](07-security-model.md) | 安全模型：同源策略、沙箱、Site Isolation、Spectre/Meltdown 防护 |

### 手写实现
| 文档 | 内容 |
|------|------|
| [mini-impl/task-scheduler.md](mini-impl/task-scheduler.md) | 手写任务调度器（宏任务/微任务/动画帧） |
| [mini-impl/dom-diff.md](mini-impl/dom-diff.md) | 手写 DOM Diff（浏览器渲染引擎视角） |
| [mini-impl/v8-gc-simulator.md](mini-impl/v8-gc-simulator.md) | 手写 V8 GC 模拟器（分代回收 + 标记清除） |

## 浏览器架构全景

```
Browser Process（主进程）
  ├─ UI Thread（地址栏、书签、前进后退）
  ├─ Network Thread（网络请求管理）
  ├─ Storage Thread（LocalStorage、IndexedDB）
  └─ GPU Thread（协调 GPU 进程）

Renderer Process（渲染进程，每个标签页一个）
  ├─ Main Thread（JS 执行、DOM、CSSOM、Layout）
  ├─ Compositor Thread（合成层、滚动）
  ├─ Raster Thread（栅格化、位图生成）
  ├─ Worker Threads（Web Workers）
  └─ IO Thread（与 Browser Process 通信）

GPU Process（GPU 进程，所有渲染进程共享）
  └─ 3D 渲染、CSS 动画合成、Canvas 加速
```
