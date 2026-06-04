/**
 * 手写Promise
 */

import CAggregateError from "./CAggregateError";

/**
 * 状态枚举
 */
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

type State = typeof PENDING | typeof FULFILLED | typeof REJECTED;


type Resolve<T> = (value: T | CPromise<T> | PromiseLike<T>) => void;
type Reject = (reason: any) => void;

export class CPromise<T = any> {
  private state: State = PENDING;
  private value?: T;
  private reason?: any;
  private onFulfilledCallbacks: Array<(value: T) => void> = [];
  private onRejectedCallbacks: Array<(reason: any) => void> = [];

  constructor(executor: (resolve: Resolve<T>, reject: Reject) => void) {
    const resolve: Resolve<T> = (value) => {
      if (this.state !== PENDING) return;
      // 如果resolve是一个thenable，需要进入“递归展开”
      resolvePromise(
        this,
        value,
        (_value) => {
          queueMicrotask(() => {
            this.state = FULFILLED;
            this.value = _value as T;
            this.onFulfilledCallbacks.forEach(cb => cb(_value as T));
          })
        },
        reason => {
          queueMicrotask(() => {
            this.state = REJECTED;
            this.reason = reason;
            this.onRejectedCallbacks.forEach(cb => cb(reason));
          })
        })
    }

    const reject: Reject = (reason) => {
      if (this.state !== PENDING) return;
      queueMicrotask(() => {
        this.state = REJECTED;
        this.reason = reason;
        this.onRejectedCallbacks.forEach(cb => cb(this.reason));
      })
    }

    try {
      // 立即执行
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  static resolve<T>(value: T | CPromise<T> | PromiseLike<T>): CPromise<T> {
    if (value instanceof CPromise) {
      return value;
    }
    if (value && typeof (value as any).then === 'function') {
      return new CPromise((resolve, reject) => (value as PromiseLike<T>).then(resolve, reject));
    }
    return new CPromise((resolve) => resolve(value));
  }

  static reject<T = never>(reason: any): CPromise<T> {
    return new CPromise((_, reject) => { reject(reason); });
  }

  static all<T>(promises: (T | PromiseLike<T> | CPromise<T>)[]): CPromise<T[]> {
    return new CPromise((resolve, reject) => {
      const result = [] as T[];
      let completed = 0;

      if (promises.length === 0) return resolve([]);

      promises.forEach((p, i) => {
        CPromise.resolve(p)
          .then(
            val => {
              result[i] = val;
              // 这样保证所有的都执行
              if (++completed === promises.length) resolve(result);
            },
            reject
          )
      })
    })
  }

  static race<T>(promises: (T | PromiseLike<T> | CPromise<T>)[]): CPromise<T> {
    return new CPromise((resolve, reject) => {
      for (const p of promises) {
        CPromise.resolve(p)
          .then(
            val => resolve(val),
            err => reject(err)
          )
      }
    })
  }

  static allSettled<T>(promises: (T | PromiseLike<T> | CPromise<T>)[]): CPromise<Array<{ status: typeof FULFILLED; value: T } | { status: typeof REJECTED; reason: any }>> {
    return new CPromise((resolve) => {
      const results = Array(promises.length);
      let completed = 0;

      if (promises.length === 0) return resolve([]);

      promises.forEach((p, i) => {
        CPromise.resolve(p).then(
          value => {
            results[i] = { status: FULFILLED, value: value };
          },
          err => {
            results[i] = { status: REJECTED, reason: err };
          }
        ).finally(() => {
          if (++completed === promises.length) resolve(results);
        })
      })
    })
  }

  static any<T>(promises: (T | PromiseLike<T> | CPromise<T>)[]): CPromise<T> {
    return new CPromise((resolve, reject) => {
      const errors: any[] = [];
      let rejectedCount = 0;

      if (promises.length === 0) {
        reject(new CAggregateError([]));
        return;
      }

      promises.forEach((p, i) => {
        CPromise.resolve(p)
          .then(
            val => resolve(val),
            err => {
              errors[i] = err;
              if (++rejectedCount === promises.length) {
                reject(new CAggregateError(errors));
              }
            }
          )
      })
    })
  }

  static try<T>(fn: () => T): CPromise<T> {
    return new CPromise<T>((resolve, reject) => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    })
  }

  static defer<T = any>(): {
    promise: CPromise<T>;
    resolve: Resolve<T>;
    reject: Reject;
  } {
    let resolve: Resolve<T> = () => { };
    let reject: Reject = () => { };
    const promise = new CPromise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    })
    return { promise, resolve, reject };
  }

  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): CPromise<TResult1 | TResult2> {
    const fulfilled = typeof onFulfilled === 'function' ? onFulfilled : (v: T) => v as any;
    const rejected = typeof onRejected === 'function' ? onRejected : (v: any) => { throw v };

    let newPromise: CPromise<TResult1 | TResult2>;

    newPromise = new CPromise((resolve, reject) => {
      const handle = (cb: Function, value: any) => {
        try {
          const x = cb(value);
          resolvePromise(newPromise, x, resolve, reject);
        } catch (error) {
          reject(error);
        }
      }

      if (this.state === FULFILLED) {
        queueMicrotask(() => handle(fulfilled, this.value))
      } else if (this.state === REJECTED) {
        queueMicrotask(() => handle(rejected, this.reason));
      } else {
        this.onFulfilledCallbacks.push((value) => handle(fulfilled, value));
        this.onRejectedCallbacks.push((reason) => handle(rejected, reason));
      }
    })

    return newPromise;
  }

  catch<TResult = never>(onRejected?: (reason: any) => TResult | PromiseLike<TResult>): CPromise<T | TResult> {
    return this.then(undefined, onRejected);
  }

  finally(cb: () => any): CPromise<T> {
    return this.then(
      value => CPromise.resolve(cb()).then(() => value, err => { throw err }),
      reason => CPromise.resolve(cb()).then(() => { throw reason }, err => { throw err })
    );
  }

  get [Symbol.toStringTag]() {
    return 'CPromise';
  }
}

/**
 * 
 * @param promise 
 * @param x 
 * @param resolve 
 * @param reject 
 * @returns 
 */
function resolvePromise<T>(
  promise: CPromise<T>,
  x: any,
  resolve: Resolve<T>,
  reject: Reject
) {
  if (promise === x) {
    // 循环
    return reject(new TypeError("Chaining cycle detected"));
  }
  let called = false;
  if (x !== null && (typeof x === "object" || typeof x === "function")) {
    try {
      const then = x.then;
      // thenable的
      if (typeof then === 'function') {
        then.call(
          x,
          (y: any) => {
            if (called) return;
            called = true;
            resolvePromise(promise, y, resolve, reject);
          },
          (r: any) => {
            if (called) return;
            called = true;
            reject(r);
          }
        )
      } else {
        if (called) return;
        called = true;
        resolve(x);
      }
    } catch (error) {
      if (called) return;
      called = true;
      reject(error);
    }
  } else {
    // 基本数据类型直接resolve
    resolve(x);
  }
}