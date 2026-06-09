# Heap Diagnosis & Memory Leak

内存泄漏是 Node.js 生产环境的隐形杀手。掌握 heap 分析是高级工程师的必备技能。

## 检测方法

### 1. 使用 V8 Inspector

```bash
# 生成 heap snapshot
node --inspect app.js
# Chrome DevTools -> Memory -> Take heap snapshot
```

### 2. 程序化生成

```ts
// heap-snapshot.ts
import { writeHeapSnapshot } from 'v8';
import fs from 'fs';

export function takeHeapSnapshot(label: string) {
  const filename = `/tmp/heap-${label}-${Date.now()}.heapsnapshot`;
  writeHeapSnapshot(filename);
  console.log(`Heap snapshot saved: ${filename}`);
  return filename;
}

// 定时采样
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: (usage.rss / 1024 / 1024).toFixed(1) + 'MB',
    heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(1) + 'MB',
    heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(1) + 'MB',
    external: (usage.external / 1024 / 1024).toFixed(1) + 'MB',
  });
}, 30000);
```

### 3. clinic.js heap profiler

```bash
npm install -g clinic
clinic heapprofiler -- node app.js
clinic doctor -- node app.js
```

## 常见泄漏源

| 源 | 症状 | 解决 |
| --- | --- | --- |
| 闭包引用 | heapUsed 持续增长 | 检查事件监听器、定时器 |
| 全局缓存 | 无上限 Map/Cache | 使用 LRU，设 maxSize |
| 流未关闭 | 文件描述符耗尽 | pipeline 后确认销毁 |
| 数据库连接 | 连接数持续增长 | 使用连接池，确认释放 |
| Promise 堆积 | 异步任务未处理 | 背压控制、限流 |

### 4. LRU Cache 替代全局 Map

```ts
// lru-cache.ts
import LRUCache from 'lru-cache';

const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5min
  updateAgeOnGet: true,
  allowStale: false,
});

export function getCached<T>(key: string, factory: () => T): T {
  const hit = cache.get(key);
  if (hit !== undefined) return hit as T;
  const value = factory();
  cache.set(key, value);
  return value;
}
```

## 分析 Heap Snapshot

1. Chrome DevTools Memory -> 加载 `.heapsnapshot`。
2. 按 Constructor 排序，找 `Shallow Size` 或 `Retained Size` 异常大的对象。
3. 对比两个时间点的 snapshot，看 `(comparison)` 视图。
4. 常见元凶：`Closure`、`Array`、`Object`、`Buffer`、`string`。
