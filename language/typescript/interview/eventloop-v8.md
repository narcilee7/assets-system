# Event Loop & V8 面试主轴

## 1. JavaScript 为什么是单线程？

浏览器和 Node.js 的 JS 引擎线程都只有一个执行栈。单线程避免了多线程操作 DOM / 共享状态带来的竞态问题，但要求所有 I/O 必须异步，否则主线程会被阻塞。

## 2. 宏任务与微任务分别有哪些？

| 类型 | 来源 |
|------|------|
| 宏任务（macrotask）| `setTimeout` / `setInterval`、I/O 回调、`setImmediate`（Node）、UI 渲染、`<script>` 整体 |
| 微任务（microtask）| `Promise.then/catch/finally`、`queueMicrotask`、`MutationObserver`、V8 微任务队列 |

执行规则：
1. 执行当前宏任务直到完成。
2. 清空本轮产生的所有微任务。
3. 进入下一次事件循环，取下一个宏任务。

## 3. `setTimeout(..., 0)` 与 `setImmediate` 谁先执行？

在浏览器中不存在 `setImmediate`；在 Node.js 中取决于当前阶段：

- 如果在 I/O 周期内，`setImmediate` 先执行。
- 如果在主模块顶部，`setTimeout(..., 0)` 可能先执行（因为 timers 阶段可能先到期）。

两者都不保证精确 0ms，只是“尽快”。

## 4. `process.nextTick` 是什么？

`nextTick` 是 Node.js 实现的独立队列，优先级高于微任务。它会在当前操作完成后、进入下一个事件循环阶段前立即执行。滥用会导致 I/O 饥饿。

## 5. `async/await` 的底层是什么？

`async` 函数返回一个 Promise；`await` 后面的值会被包装成 Promise，并通过 `Promise.resolve()` 注册回调。因此 `await` 后续的代码会进入微任务队列。

```js
async function foo() {
  console.log(1);
  await Promise.resolve();
  console.log(2); // 微任务
}
foo();
console.log(3);
// 1 3 2
```

## 6. V8 如何执行一段 JS？

1. **解析（Parsing）**：生成 AST。
2. **编译**：
   - Ignition 解释器生成字节码并执行。
   - 热点代码被 TurboFan 编译为优化机器码。
3. **执行**：调用栈 + 堆 + 事件循环协同。
4. **垃圾回收**：分代回收（新生代 Scavenge、老生代 Mark-Sweep-Compact）。

## 7. 什么是 Event Loop 的“阶段”？

Node.js 事件循环阶段：

```
timers → pending callbacks → idle/prepare → poll → check → close callbacks
```

- `timers`：`setTimeout` / `setInterval`。
- `poll`：等待 I/O 并执行 I/O 回调。
- `check`：`setImmediate`。

## 8. 手写一个微任务调度器

```ts
function queueMicrotaskFallback(fn: () => void): void {
  Promise.resolve().then(fn);
}
```

真实环境优先用 `queueMicrotask`。

## 9. 常见面试代码题

```js
console.log("script start");
setTimeout(() => console.log("timeout"), 0);
Promise.resolve().then(() => console.log("promise1"));
Promise.resolve().then(() => console.log("promise2"));
console.log("script end");
// script start → script end → promise1 → promise2 → timeout
```

## 10. 性能优化角度

- 避免在 `mousemove` / `scroll` 中同步修改 DOM，使用 `requestAnimationFrame`。
- 大量微任务会阻塞渲染，必要时切分任务。
- 长任务使用 `setImmediate` / `MessageChannel` 让出主线程。
