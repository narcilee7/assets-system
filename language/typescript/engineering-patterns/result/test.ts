import { describe, it, expect } from 'vitest';
import { ok, err, fromThrowable, fromPromise, type Result } from './impl';

describe('Result', () => {
  it('Ok basic', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.unwrap()).toBe(42);
  });

  it('Err basic', () => {
    const r = err('fail');
    expect(r.err).toBe(true);
    expect(() => r.unwrap()).toThrow('fail');
  });

  it('Ok map', () => {
    const r = ok(2).map((x) => x * 2);
    expect(r.unwrap()).toBe(4);
  });

  it('Err map short-circuits', () => {
    const r = err<number, string>('fail').map((x) => x * 2);
    expect(r.err).toBe(true);
    expect((r as any).error).toBe('fail');
  });

  it('Ok andThen', () => {
    const r = ok(2).andThen((x) => ok(x * 3));
    expect(r.unwrap()).toBe(6);
  });

  it('Err andThen short-circuits', () => {
    const r = err<number, string>('fail').andThen((x) => ok(x * 3));
    expect(r.err).toBe(true);
  });

  it('unwrapOr', () => {
    expect(ok(42).unwrapOr(0)).toBe(42);
    expect(err('fail').unwrapOr(0)).toBe(0);
  });

  it('match', () => {
    const r1 = ok(42).match({
      ok: (v) => `value=${v}`,
      err: (e) => `error=${e}`,
    });
    expect(r1).toBe('value=42');

    const r2 = err('fail').match({
      ok: (v) => `value=${v}`,
      err: (e) => `error=${e}`,
    });
    expect(r2).toBe('error=fail');
  });

  it('mapErr', () => {
    const r = err('fail').mapErr((e) => `ERROR: ${e}`);
    expect((r as any).error).toBe('ERROR: fail');
  });

  it('fromThrowable success', () => {
    const r = fromThrowable(() => 42);
    expect(r.unwrap()).toBe(42);
  });

  it('fromThrowable failure', () => {
    const r = fromThrowable(
      () => {
        throw new Error('boom');
      },
      (e) => (e as Error).message
    );
    expect(r.err).toBe(true);
    expect((r as any).error).toBe('boom');
  });

  it('fromPromise success', async () => {
    const r = await fromPromise(Promise.resolve(42));
    expect(r.unwrap()).toBe(42);
  });

  it('fromPromise failure', async () => {
    const r = await fromPromise(
      Promise.reject(new Error('async boom')),
      (e) => (e as Error).message
    );
    expect(r.err).toBe(true);
    expect((r as any).error).toBe('async boom');
  });

  it('pipeline', () => {
    const parse = (s: string): Result<number, string> => {
      const n = parseInt(s, 10);
      return Number.isNaN(n) ? err('parse error') : ok(n);
    };

    const validate = (n: number): Result<number, string> =>
      n > 0 ? ok(n) : err('must be positive');

    const result = ok('42')
      .andThen(parse)
      .andThen(validate)
      .map((n) => n * 2);

    expect(result.unwrap()).toBe(84);
  });
});
