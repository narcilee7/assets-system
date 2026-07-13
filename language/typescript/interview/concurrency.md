# Concurrency 并发面试主轴

## 1. Promise 状态机

Promise 三种状态：`pending`、`fulfilled`、`rejected`。状态一旦改变不可再变。

```ts
new Promise((resolve, reject) => {
  resolve(1);
  reject(2); // 被忽略
});
```

## 2. `then` 的链式调用

`then` 返回一个新的 Promise，值由回调返回值决定。

```ts
Promise.resolve(1)
  .then((x) => x + 1)
  .then((x) => Promise.resolve(x + 1))
  .then(console.log); // 3
```

## 3. Promise 组合 API

| API | 行为 |
|-----|------|
| `Promise.all` | 全部成功返回数组；任一失败整体失败 |
| `Promise.race` | 返回最快完成的那个 |
| `Promise.allSettled` | 等待全部完成，返回状态数组 |
| `Promise.any` | 返回第一个成功的；全部失败抛 AggregateError |

## 4. async/await 的并行与串行

```ts
// 串行
const a = await fetchA();
const b = await fetchB();

// 并行
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

## 5. 并发控制

限制同时运行的异步任务数量，防止资源耗尽。

```ts
async function boundedGather<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();
  for (const [i, item] of items.entries()) {
    const p = fn(item).then((r) => {
      results[i] = r;
    });
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
    p.finally(() => executing.delete(p));
  }
  await Promise.all(executing);
  return results;
}
```

## 6. 取消信号 AbortController

```ts
const controller = new AbortController();
fetch("/api", { signal: controller.signal });
controller.abort();
```

自定义异步任务也应监听 `signal.aborted` 或 `abort` 事件。

## 7. Async Iterator

```ts
async function* gen() {
  yield 1;
  yield await Promise.resolve(2);
}

for await (const x of gen()) {
  console.log(x);
}
```

适合流式数据、分页拉取。

## 8. 竞态与同步

```ts
class SafeCounter {
  private value = 0;
  private queue = Promise.resolve();

  increment(): Promise<number> {
    return (this.queue = this.queue.then(async () => {
      await Promise.resolve();
      return ++this.value;
    }));
  }
}
```

或者使用 `Mutex` / `Semaphore`。

## 9. 调度器

- `setTimeout` / `setInterval`：简单延迟。
- `setImmediate` / `process.nextTick`：尽快执行。
- `requestAnimationFrame`：浏览器渲染帧。
- `queueMicrotask`：当前任务后、渲染前。

## 10. 常见面试题

```js
async function foo() {
  console.log(1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  console.log(2);
}
foo();
console.log(3);
setTimeout(() => console.log(4), 0);
// 1 3 2 4
```

`await` 让出主线程，回调进入微任务 / 宏任务队列。
