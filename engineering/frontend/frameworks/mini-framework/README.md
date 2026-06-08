# Mini Framework（手写 React 核心）

通过手写一个简化版 React，理解框架内部原理。

## 训练哲学

1. **先实现，后验证**：每个模块先跑通骨架，再对比真实 React 行为。
2. **从 0 到 1**：不依赖任何第三方库，从 DOM 操作开始构建。
3. **可测试**：每个模块有独立的测试用例。

## 体系索引

### 阶段一：响应式基础（Reactivity Foundation）
| 编号 | 题目 | 核心概念 | 状态 |
|------|------|----------|------|
| 01 | [reactive-state](01-reactive-state/) | observe、notify、subscriber、effect | skeleton |
| 02 | [signals](02-signals/) | signal、computed、batch、untrack | skeleton |

### 阶段二：渲染引擎（Rendering Engine）
| 编号 | 题目 | 核心概念 | 状态 |
|------|------|----------|------|
| 03 | [vdom](03-vdom/) | h、createElement、render、patch | skeleton |
| 04 | [reconciler](04-reconciler/) | fiber、workLoop、commit、priority | todo |
| 05 | [scheduler](05-scheduler/) | taskQueue、priority、yield、interrupt | todo |

### 阶段三：Hooks 实现（Hooks Implementation）
| 编号 | 题目 | 核心概念 | 状态 |
|------|------|----------|------|
| 06 | [useState](06-use-state/) | hooks链表、dispatch、batching | todo |
| 07 | [useEffect](07-use-effect/) | effect list、cleanup、dep comparison | todo |
| 08 | [useRef](08-use-ref/) | ref object、immutable、no-render | todo |

### 阶段四：完整框架（Complete Framework）
| 编号 | 题目 | 核心概念 | 状态 |
|------|------|----------|------|
| 09 | [mini-react](09-mini-react/) | 整合以上所有模块 | todo |

## 追问清单

- 响应式和 Vue 的 proxy 响应式有什么区别？
- Fiber 的 "interruptible" 如何实现？
- Scheduler 的 task priority 是如何确定的？
- useEffect 的 cleanup 如何与组件卸载对应？
- batching 是如何把多次 setState 合并为一次 render 的？

## 快速开始

```bash
cd engineering/frontend/frameworks/mini-framework/01-reactive-state
make run      # 运行骨架
make test     # 验证实现
```

更多环境细节见 [ENV.md](ENV.md)。