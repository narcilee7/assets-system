# 单元测试

## 1. Vitest（推荐）

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'test/'],
    },
  },
});
```

```typescript
// sum.test.ts
import { describe, it, expect } from 'vitest';
import { sum, divide } from './math';

describe('math', () => {
  it('should sum numbers', () => {
    expect(sum(1, 2)).toBe(3);
  });

  it('should throw on divide by zero', () => {
    expect(() => divide(1, 0)).toThrow('Cannot divide by zero');
  });

  it.each([
    [1, 1, 2],
    [2, 3, 5],
    [-1, 1, 0],
  ])('sum(%i, %i) = %i', (a, b, expected) => {
    expect(sum(a, b)).toBe(expected);
  });
});
```

## 2. Mock

```typescript
// 函数 mock
const mockFn = vi.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ data: [] });

// 模块 mock
vi.mock('./api', () => ({
  fetchUser: vi.fn(() => Promise.resolve({ id: 1, name: 'John' })),
}));

// 时间控制
vi.useFakeTimers();
vi.advanceTimersByTime(1000);

// 间谍
const spy = vi.spyOn(console, 'log');
expect(spy).toHaveBeenCalledWith('hello');
```

## 3. 异步测试

```typescript
it('should fetch data', async () => {
  const result = await fetchData();
  expect(result).toEqual({ items: [] });
});

it('should handle timeout', async () => {
  await expect(fetchWithTimeout('/slow', 100)).rejects.toThrow('timeout');
});
```
