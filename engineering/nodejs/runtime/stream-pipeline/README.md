# Stream Pipeline & Backpressure

Node.js Stream 是处理大规模数据的核心抽象。理解背压（backpressure）能避免内存爆炸和服务崩溃。

## 核心概念

| 类型 | 说明 |
| --- | --- |
| Readable | 数据源（文件、HTTP 请求） |
| Writable | 数据目标（文件、HTTP 响应） |
| Transform | 中间转换（压缩、加密） |
| Duplex | 可读可写（TCP socket） |

## 资产

### 1. 手动背压处理（理解原理）

```js
// manual-backpressure.js
const fs = require('fs');
const readable = fs.createReadStream('./large-file.txt');
const writable = fs.createWriteStream('./copy.txt');

readable.on('data', (chunk) => {
  const ok = writable.write(chunk);
  if (!ok) {
    // 缓冲区满，暂停读取
    readable.pause();
    writable.once('drain', () => readable.resume());
  }
});

readable.on('end', () => writable.end());
```

### 2. pipeline（生产环境推荐）

```js
// pipeline-demo.js
const fs = require('fs');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');

async function run() {
  await pipeline(
    fs.createReadStream('./input.txt'),
    zlib.createGzip(),
    fs.createWriteStream('./input.txt.gz')
  );
  console.log('Pipeline succeeded');
}

run().catch(console.error);
```

### 3. Transform Stream 示例

```js
// transform-line-parser.js
const { Transform } = require('stream');

const lineParser = new Transform({
  objectMode: true,
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) this.push(JSON.parse(line));
    }
    callback();
  },
});

module.exports = { lineParser };
```

## 背压原理图解

```
Readable (highWaterMark: 16KB)
   |  data event
   v
Writable internal buffer (highWaterMark)
   |  write() returns false -> 暂停 Readable
   v
Kernel -> File / Socket
```

## 运行

```bash
# 生成测试大文件
dd if=/dev/zero of=large-file.txt bs=1m count=100

# 运行 demo
node manual-backpressure.js
node pipeline-demo.js
```

## 性能对比

| 方式 | 内存占用 | 代码复杂度 | 容错 |
| --- | --- | --- | --- |
| pipe() | 中 | 低 | 差（不自动销毁） |
| pipeline() | 低 | 低 | 好（自动清理） |
| 手动 backpressure | 低 | 高 | 中 |

> 生产环境永远优先使用 `stream/promises` 的 `pipeline()` 或 `pipeline(..., { signal })`。
