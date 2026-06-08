# Unit Testing with Vitest

Vitest 是 Jest 的现代替代：更快、原生 ESM、TypeScript 支持更好。

## 配置

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
```

## 示例测试

```ts
// order.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { OrderService } from '../modules/order/order.service';
import { OrderRepository } from '../modules/order/order.repository';

describe('OrderService', () => {
  it('should create an order', async () => {
    const repo = {
      create: vi.fn().mockResolvedValue({ id: '1', productId: 'p1', quantity: 2 }),
    } as unknown as OrderRepository;

    const service = new OrderService(repo);
    const result = await service.create({ productId: 'p1', quantity: 2 });

    expect(result.id).toBe('1');
    expect(repo.create).toHaveBeenCalledWith({ productId: 'p1', quantity: 2 });
  });

  it('should throw when order not found', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(undefined) } as unknown as OrderRepository;
    const service = new OrderService(repo);
    await expect(service.findOne('999')).rejects.toThrow('Order 999 not found');
  });
});
```

## Mock 策略

| 场景 | 方式 |
| --- | --- |
| 模块级 mock | `vi.mock('./db')` |
| 局部 mock | `vi.spyOn(obj, 'method')` |
| 定时器 | `vi.useFakeTimers()` |
| 环境变量 | `vi.stubEnv('KEY', 'value')` |

## 运行

```bash
npx vitest              # watch mode
npx vitest run          # CI mode
npx vitest --coverage   # 带覆盖率
```
