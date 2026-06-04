/**
 * Result - 显式错误建模
 */

export class Ok<T> {
  readonly ok = true as const;
  readonly err = false as const;

  constructor(readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_fn: (error: never) => F): Result<T, F> {
    return new Ok(this.value);
  }

  andThen<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  match<U, F>(handlers: { ok: (value: T) => U; err: (error: never) => F }): U {
    return handlers.ok(this.value);
  }
}

export class Err<E> {
  readonly ok = false as const;
  readonly err = true as const;

  constructor(readonly error: E) {}

  map<U>(_fn: (value: never) => U): Result<U, E> {
    return new Err(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<never, F> {
    return new Err(fn(this.error));
  }

  andThen<U, _E>(_fn: (value: never) => Result<U, _E>): Result<U, E> {
    return new Err(this.error);
  }

  unwrap(): never {
    throw this.error;
  }

  unwrapOr<T>(defaultValue: T): T {
    return defaultValue;
  }

  match<U, F>(handlers: { ok: (value: never) => U; err: (error: E) => F }): F {
    return handlers.err(this.error);
  }
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Result<T, never> {
  return new Ok(value);
}

export function err<E>(error: E): Result<never, E> {
  return new Err(error);
}

// --- 辅助：从可能 throw 的函数构造 Result ---

export function fromThrowable<T, E = Error>(
  fn: () => T,
  onError?: (e: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    return err(onError ? onError(e) : (e as E));
  }
}

// --- 辅助：异步 Result ---

export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  onError?: (e: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    return err(onError ? onError(e) : (e as E));
  }
}
