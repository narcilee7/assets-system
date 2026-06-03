# JavaScript

JavaScript 这条线训练浏览器 / Node 运行时基础、原型链对象模型、函数式抽象、异步模型和常见手写题。

Node.js 的工程化后端能力独立沉淀在 `engineering/nodejs/`：包括服务框架、ORM、任务队列、实时通信、可观测和部署。

## 能力层

| 层级 | 目录 | 内容 |
| --- | --- | --- |
| Runtime Model | `runtime-model/` | 执行上下文、作用域链、闭包、this、原型链、事件循环 |
| Core Abstractions | `core-abstractions/` | 函数、柯里化、数组方法、对象操作、继承 |
| Concurrency | `concurrency/` | Promise、微任务、宏任务、取消、重试、并发控制 |
| Standard Library | `standard-library/` | Array、Object、RegExp、URL、Fetch / XHR |
| Engineering Patterns | `engineering-patterns/` | debounce、throttle、EventEmitter、request、JSONP |
| Mini Runtime | `mini-runtime/` | mini Promise、mini module、mini reactive、mini router |
| Legacy Assets | `handwritten/` | 已迁移的原始手写题资产 |

## 当前资产映射

| 主题 | 当前目录 |
| --- | --- |
| Promise 组合 API | `handwritten/Promise_Polyfill/` |
| 数组方法 | `handwritten/array/` |
| 原型链 / new / bind / call / apply | `handwritten/proto/`、`handwritten/extend/` |
| this | `handwritten/this/` |
| 函数柯里化 | `handwritten/fn_curry/` |
| 深浅拷贝 | `handwritten/clone/` |
| debounce / throttle | `handwritten/debounce/`、`handwritten/throttle/` |
| EventEmitter | `handwritten/eventEmitter/` |
| 网络请求 | `handwritten/ajax/`、`handwritten/jsonp/`、`handwritten/request/` |

## 核心题单

| 优先级 | 资产 | 状态 | 目标 |
| --- | --- | --- | --- |
| P0 | Promise / Promise.all / race / any / allSettled | draft | 异步状态机和微任务 |
| P0 | call / apply / bind / new / instanceof | draft | 原型链和函数调用 |
| P0 | debounce / throttle | draft | 高频前端工程工具 |
| P1 | Array map / filter / reduce / flat | draft | 迭代和回调抽象 |
| P1 | EventEmitter | draft | 发布订阅和事件系统 |
| P1 | deepClone | draft | 引用、循环引用、结构复制 |
| P2 | mini reactive | todo | 前端框架响应式模型 |
| P2 | mini router | todo | SPA 路由模型 |

## 下一步

先从 `handwritten/` 中挑 P0 资产补齐：

```text
README.md
impl.js
test.js
review.md
```

优先补 Promise、原型链、debounce/throttle，因为它们能同时覆盖语言机制和工程场景。
