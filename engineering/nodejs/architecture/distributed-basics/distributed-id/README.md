# Distributed ID Generation

分布式系统中，单节点自增 ID 不再适用，需要全局唯一、趋势递增、高性能的 ID 生成方案。

## 方案对比

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| UUID v4 | 全局唯一、无中心 | 无序、占用空间大、索引性能差 |
| UUID v7 | 时间排序、兼容 UUID | 仍需 128bit |
| Snowflake | 趋势递增、高性能 | 依赖时钟同步、需分配 Worker ID |
| 数据库号段 | 简单、趋势递增 | 数据库压力大、有单点风险 |
| Leaf（美团） | 号段 + Snowflake 结合 | 需独立服务 |

## Snowflake 实现

```ts
// snowflake.ts
export class Snowflake {
  private static readonly EPOCH = 1704067200000n; // 2024-01-01
  private static readonly WORKER_ID_BITS = 5n;
  private static readonly DATACENTER_ID_BITS = 5n;
  private static readonly SEQUENCE_BITS = 12n;

  private static readonly MAX_WORKER_ID = (1n << Snowflake.WORKER_ID_BITS) - 1n;
  private static readonly MAX_DATACENTER_ID = (1n << Snowflake.DATACENTER_ID_BITS) - 1n;
  private static readonly SEQUENCE_MASK = (1n << Snowflake.SEQUENCE_BITS) - 1n;

  private static readonly WORKER_ID_SHIFT = Snowflake.SEQUENCE_BITS;
  private static readonly DATACENTER_ID_SHIFT = Snowflake.SEQUENCE_BITS + Snowflake.WORKER_ID_BITS;
  private static readonly TIMESTAMP_SHIFT = Snowflake.SEQUENCE_BITS + Snowflake.WORKER_ID_BITS + Snowflake.DATACENTER_ID_BITS;

  private lastTimestamp = -1n;
  private sequence = 0n;

  constructor(
    private workerId: bigint,
    private datacenterId: bigint,
  ) {
    if (workerId > Snowflake.MAX_WORKER_ID || workerId < 0n) {
      throw new Error(`Worker ID must be between 0 and ${Snowflake.MAX_WORKER_ID}`);
    }
    if (datacenterId > Snowflake.MAX_DATACENTER_ID || datacenterId < 0n) {
      throw new Error(`Datacenter ID must be between 0 and ${Snowflake.MAX_DATACENTER_ID}`);
    }
  }

  nextId(): bigint {
    let timestamp = this.currentTimestamp();

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards');
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & Snowflake.SEQUENCE_MASK;
      if (this.sequence === 0n) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    return (
      ((timestamp - Snowflake.EPOCH) << Snowflake.TIMESTAMP_SHIFT) |
      (this.datacenterId << Snowflake.DATACENTER_ID_SHIFT) |
      (this.workerId << Snowflake.WORKER_ID_SHIFT) |
      this.sequence
    );
  }

  private currentTimestamp(): bigint {
    return BigInt(Date.now());
  }

  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTimestamp();
    }
    return timestamp;
  }
}

// 使用
const snowflake = new Snowflake(1n, 1n);
console.log(snowflake.nextId().toString()); // 如 "1791234567890123456"
```

## UUID v7（推荐）

```ts
// uuidv7.ts
import { v7 as uuidv7 } from 'uuid';

export function generateId(): string {
  return uuidv7(); // 时间排序的 UUID，如 "0190e123-4567-7abc-8def-0123456789ab"
}
```

## 数据库号段方案

```ts
// segment-id.ts
// Leaf 号段模式简化版
class SegmentIdGenerator {
  private current = 0;
  private max = 0;
  private step = 1000;

  async nextId(): Promise<number> {
    if (this.current >= this.max) {
      const segment = await db.transaction(async (trx) => {
        const [record] = await trx('id_generator')
          .where({ biz_type: 'order' })
          .forUpdate()
          .select('*');

        const maxId = record.max_id + this.step;
        await trx('id_generator')
          .where({ biz_type: 'order' })
          .update({ max_id: maxId, update_time: new Date() });

        return { current: record.max_id, max: maxId };
      });

      this.current = segment.current;
      this.max = segment.max;
    }

    return ++this.current;
  }
}
```

## 选型建议

| 场景 | 推荐 |
| --- | --- |
| 需要展示给用户 | UUID v7（时间排序、可读性好） |
| 高并发内部系统 | Snowflake（性能最高） |
| 已有数据库、低并发 | 号段模式 |
| 需要绝对无序（安全） | UUID v4 |
