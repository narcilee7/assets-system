import { describe, it, expect, vi } from 'vitest';
import { CPromise } from './CPromise'; // 假设你实现的类叫 CPromise

describe('CPromise', () => {
  it('should resolve a value', async () => {
    const result = await new CPromise((res) => res(42));
    expect(result).toBe(42);
  });

  it('should execute then asynchronously', async () => {
    const logs: string[] = [];
    const p = new CPromise((res) => res('ok'));
    logs.push('before');
    p.then((val) => logs.push(val));
    logs.push('after');
    await Promise.resolve(); // 等待微任务
    expect(logs).toEqual(['before', 'after', 'ok']);
  });

  it('should chain then', async () => {
    const result = await new CPromise((res) => res(1))
      .then((x) => x + 1)
      .then((x) => x + 1);
    expect(result).toBe(3);
  });

  it('should catch errors', async () => {
    const err = await new CPromise((_, rej) => rej('fail')).catch((e) => e);
    expect(err).toBe('fail');
  });

  it('should run finally', async () => {
    const log = vi.fn();
    const result = await CPromise.resolve(100).finally(log);
    expect(result).toBe(100);
    expect(log).toHaveBeenCalled();
  });

  it('should resolve thenable', async () => {
    const thenable = {
      then(resolve: (v: any) => void) {
        resolve('thenable');
      },
    };
    const result = await CPromise.resolve(thenable);
    expect(result).toBe('thenable');
  });

  it('should CPromise.all', async () => {
    const result = await CPromise.all([
      CPromise.resolve(1),
      2,
      new CPromise((res) => setTimeout(() => res(3), 10)),
    ]);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should CPromise.race', async () => {
    const result = await CPromise.race([
      new CPromise((res) => setTimeout(() => res('slow'), 20)),
      CPromise.resolve('fast'),
    ]);
    expect(result).toBe('fast');
  });

  it('should CPromise.any', async () => {
    const result = await CPromise.any([
      CPromise.reject('fail'),
      new CPromise((res) => setTimeout(() => res('pass'), 10)),
    ]);
    expect(result).toBe('pass');
  });

  it('should reject CPromise.any if all fail', async () => {
    try {
      await CPromise.any([CPromise.reject('a'), CPromise.reject('b')]);
    } catch (err: any) {
      expect(err.errors).toEqual(['a', 'b']); // AggregateError
    }
  });
});
