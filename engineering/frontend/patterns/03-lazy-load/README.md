# 03 Lazy Load（延迟加载）

## 问题描述

实现图片懒加载和代码分割两套延迟加载机制。

### Part A: 图片懒加载

- 监听图片进入视口时再加载真实 `src`。
- 使用 `IntersectionObserver` API（或 scroll 事件模拟）。
- 支持占位图和加载失败兜底。

### Part B: 动态导入（Code Splitting）

- 实现一个 `lazyLoad(importFn)` 函数，返回一个组件。
- 首次渲染时触发 `importFn()` 加载模块，加载完成前显示 loading。
- 支持缓存已加载的模块。

## 核心概念

- **IntersectionObserver**：异步观察元素与视口的交叉状态。
- **Code Splitting**：将代码拆分为独立 chunk，按需加载。
- **Suspense**：React 的加载状态管理（可选对比）。

## 约束

- 不得使用 `<img loading="lazy">` 浏览器内置能力。
- `IntersectionObserver` 在 Node.js 中需模拟。
- 动态导入在 Node.js 中使用 `require()` 模拟。

## 验证方式

```bash
make run   # 运行骨架
make test  # 验证逻辑正确性
```

## 追问

- 懒加载图片的骨架屏（placeholder）如何避免布局抖动（CLS）？
- 如何处理懒加载失败的重试？
- Code Splitting 的 chunk 缓存策略是什么？
- prefetch / preload 如何实现？