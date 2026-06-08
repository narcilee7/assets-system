# Frontend Patterns

前端工程构件训练体系 —— 从经典交互模式到复杂状态管理。

## 训练哲学

1. **先手写，后对照**：每个题目只提供骨架代码（skeleton），核心逻辑处标有 `TODO`。先尝试独立完成，再查阅参考实现。
2. **多语言视角**：同一问题用 TypeScript（浏览器环境模拟）、Node.js（Node 环境）分别实现，理解不同运行时的差异。
3. **可验证**：每个题目附带 `Makefile` 和自测用例，写完即可运行验证。

## 体系索引

### 第一阶段：基础交互模式（Basic Interaction Patterns）
| 编号 | 题目 | 核心概念 | TS | Node.js |
|------|------|----------|----|--------|
| 01 | [debounce-throttle](01-debounce-throttle/) | 防抖、节流、立即执行、取消 | ✅ | ✅ |
| 02 | [virtual-list](02-virtual-list/) | 虚拟列表、DOM 复用、视口计算 | ✅ | ✅ |
| 03 | [lazy-load](03-lazy-load/) | 图片懒加载、Code Splitting、IntersectionObserver | ✅ | ✅ |

### 第二阶段：状态管理（State Management）
| 编号 | 题目 | 核心概念 | TS | Node.js |
|------|------|----------|----|--------|
| 04 | [form-manager](04-form-manager/) | 表单状态、验证规则、受控/非受控 | ✅ | ✅ |

## 追问清单（训练后自测）

- 防抖的 `maxWait` 如何实现？何时需要？
- 虚拟列表如何处理动态高度的项？
- 懒加载图片的 CLS（布局抖动）如何避免？
- Code Splitting 的 chunk 缓存策略是什么？
- 表单验证的异步验证如何处理？
- 如何实现数组字段的动态添加/删除？

## 快速开始

```bash
cd engineering/frontend/patterns/01-debounce-throttle
# 阅读题目
make run      # 运行当前骨架（预期会失败或输出不正确）
# 打开 skeleton/ 下的目标语言文件，补全 TODO
make test     # 验证你的实现
```

更多环境细节见 [ENV.md](ENV.md)。