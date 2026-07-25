# Node.js Runtime 面试主轴

## 1. Node.js 的架构

Node.js = libuv（事件循环 + 线程池）+ V8（JS 引擎）+ 内置模块（fs、net、http 等）。

主线程执行 JS，I/O 通过 libuv 的线程池或操作系统异步 API 完成，完成后把回调放入事件循环队列。

## 2. 模块系统：CommonJS vs ESM

| 特性 | CJS | ESM |
|------|-----|-----|
| 语法 | `require` / `module.exports` | `import` / `export` |
| 加载时机 | 运行时同步加载 | 编译时静态分析 |
| 顶层 this | `module.exports` | `undefined` |
| 动态导入 | `require()` | `import()` |
| 循环依赖 | 返回已执行部分 | 返回绑定引用 |

TS + Node 使用 `"type": "module"` 或在 `.mts` 文件中使用 ESM。

## 3. `package.json` 的 `exports` / `types`

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

`types` 字段必须放在条件导出最前面，否则 TS 可能解析不到类型。

## 4. Buffer 与 Stream

- `Buffer`：Node 对 Uint8Array 的扩展，用于二进制数据。
- `Stream`：处理大文件 / 网络数据的核心抽象，分 Readable、Writable、Duplex、Transform。

```ts
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

await pipeline(createReadStream("src.txt"), createWriteStream("dst.txt"));
```

背压（backpressure）机制防止内存爆炸。

## 5. EventEmitter

```ts
import { EventEmitter } from "node:events";

const ee = new EventEmitter();
ee.on("data", console.log);
ee.emit("data", 1);
```

注意：
- `once` 只触发一次。
- `error` 事件未监听会抛出。
- 监听过多会告警 `MaxListenersExceededWarning`。

## 6. Cluster 模块

```ts
import cluster from "node:cluster";
import { createServer } from "node:http";

if (cluster.isPrimary) {
  for (let i = 0; i < 4; i++) cluster.fork();
} else {
  createServer((req, res) => res.end("ok")).listen(3000);
}
```

Cluster 通过主进程 fork 多个工作进程共享端口，提升 CPU 利用率。

## 7. `process.nextTick` vs `setImmediate`

- `process.nextTick`：当前操作完成后立即执行，优先级最高。
- `setImmediate`：事件循环 check 阶段执行。

```js
setImmediate(() => console.log("immediate"));
process.nextTick(() => console.log("nextTick"));
// nextTick → immediate
```

## 8. 文件系统

- `fs.readFile` / `fs.writeFile`：一次性读写，适合小文件。
- `fs.createReadStream` / `fs.createWriteStream`：流式，适合大文件。
- `fs.promises`：Promise API。

## 9. 路径解析

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

ESM 中不直接提供 `__dirname`，需要手动构造。

## 10. 调试与性能

- `node --inspect` + Chrome DevTools。
- `node --prof` / `clinic.js` / `0x` 做性能分析。
- 避免阻塞主线程：大计算使用 Worker Threads。
