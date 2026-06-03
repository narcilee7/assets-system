import CAggregateError from "./CAggregateError"

/**
 * 状态
 */
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

type State = typeof PENDING | typeof FULFILLED | typeof REJECTED

type Resolve<T> = (v: T | PromiseLike<T>) => void

type Reject = (reason: any) => void

type Executor<T> = (resolve: Resolve<T>, reject: Reject) => void

type ResolveParams<T> = T | DPromise<T> | PromiseLike<T>

type AllSettledResponse<T> = DPromise<Array<SettledResponseItem<T>>>

type SettledResponseItem<T> =
  | { status: typeof FULFILLED; value: T } 
  | { status: typeof REJECTED; reason: any }

type OnFulfilled<T, TResult> = 
  | ((value: T) => TResult | PromiseLike<TResult>) 
  | null 
  | undefined

type OnRejected<TResult> = 
  | ((reason: any) => TResult | PromiseLike<TResult>) 
  | null 
  | undefined

class DPromise<T = any> {
  private state: State = PENDING
  private value?: T
  private reason?: any
  private onFulfilledCallbacks: Array<(value: T) => void> = []
  private onRejectedCallbacks: Array<(reason: any) => void> = []

  constructor(
    executor: Executor<T>
  ) {
    const resolve: Resolve<T> = val => {
      if (this.state !== PENDING) {
        return
      }
      // 如果resolve是一个thenable，需要进入“递归展开”
      resolvePromise(
        this,
        val,
        (_val) => {
          queueMicrotask(() => {
            this.state = PENDING
            this.value = _val as T
            this.onFulfilledCallbacks.forEach(cb => cb(_val as T))
          })
        },
        (reason) => {
          queueMicrotask(() => {
            this.state = PENDING
            this.reason = reason
            this.onRejectedCallbacks.forEach(cb => cb(reason))
          })
        }
      )
    }

    const reject: Reject = reason => {
      if (this.state !== PENDING) {
        return
      }
      queueMicrotask(() => {
        this.state = REJECTED
        this.reason = reason
        this.onRejectedCallbacks.forEach(cb => cb(this.reason))
      })
    }

    try {
      // 立即执行
      executor(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }

  static resolve<T>(val: ResolveParams<T>): DPromise<T> {
    if (val instanceof DPromise) {
      return val
    }
    if (val && typeof (val as any).then === 'function') {
      return new DPromise((resolve, reject) =>
        (val as PromiseLike<T>).then(resolve, reject)
      )
    }
    return new DPromise((resolve) => resolve(val))
  }

  static reject<T = never>(reason: any): DPromise<T> {
    return new DPromise((_, reject) => { reject(reason) }
    )
  }

  static all<T>(promises: ResolveParams<T>[]): DPromise<T[]> {
    return new DPromise((resolve, reject) => {
      const result = [] as T[]
      let completed = 0

      if (promises.length === 0) return resolve([])

      promises.forEach((promise, i) => {
        DPromise.resolve(promise)
          .then(
            val => {
              result[i] = val
              if (++completed === promises.length) resolve(result)
            },
            reject
          )
      })
    })
  }

  static race<T>(promises: ResolveParams<T>[]): DPromise<T> {
    return new DPromise((resolve, reject) => {
      for (const promise of promises) {
        DPromise.resolve(promise)
          .then(resolve, reject)
      }
    })
  }

  static allSettled<T>(promises: ResolveParams<T>[]): AllSettledResponse<T> {
    return new DPromise((resolve) => {
      const results = Array(promises.length)
      let completed = 0

      if (promises.length === 0) return resolve([])

      promises.forEach((promise, i) => {
        DPromise.resolve(promise)
          .then(
            value => {
              results[i] = { status: FULFILLED, value: value }
            },
            err => {
              results[i] = { status: REJECTED, reason: err }
            }
          )
          .finally(() => {
            if (++completed === promises.length) {
              resolve(results)
            }
          })
      })
    })
  }

  static any<T>(promises: ResolveParams<T>[]): DPromise<T> {
    return new DPromise((resolve, reject) => {
      const errors: any[] = []
      let rejectCount = 0

      if (promises.length === 0) {
        reject(new CAggregateError([]))
        return
      }

      promises.forEach((promise, i) => {
        DPromise.resolve(promise)
          .then(
            val => resolve(val),
            err => {
              errors[i] = err
              if (++rejectCount === promises.length) {
                reject(new CAggregateError(errors))
              }
            }
          )
      })
    })
  }

  static try<T>(fn: () => T): DPromise<T> {
    return new DPromise<T>((resolve, reject) => {
      try {
        resolve(fn())
      } catch (error) {
        reject(error)
      }
    })
  }

  static defer<T = any>(): {
    promise: DPromise<T>,
    resolve: Resolve<T>,
    reject: Reject
  } {
    let resolve: Resolve<T> = () => { }
    let reject: Reject = () => { }
    const promise = new DPromise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return {
      promise,
      resolve,
      reject
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: OnFulfilled<T, TResult1>,
    onRejected?: OnRejected<TResult2>
  ): DPromise<TResult1 | TResult2> {
    const fulfilled =
      typeof onFulfilled === 'function'
        ? onFulfilled :
        (v: T) => v as any
    const rejected =
      typeof onRejected === 'function'
        ? onRejected :
        (e: any) => { throw e }

    const newPromise = new DPromise((resolve, reject) => {
      const handler = (cb: Function, val: any) => {
        try {
          const x = cb(val)
          resolvePromise(newPromise, x, resolve, reject)
        } catch (error) {
          reject(error)
        }
      }

      if (this.state === FULFILLED) {
        queueMicrotask(() => handler(fulfilled, this.value))
      } else if (this.state === REJECTED) {
        queueMicrotask(() => handler(reject, this.reason))
      } else {
        this.onFulfilledCallbacks.push(val => handler(fulfilled, val))
        this.onRejectedCallbacks.push(reason => handler(reject, reason))
      }
    })

    return newPromise
  }

  catch<TResult = never>(
    onRejected?: (reason: any) => TResult | PromiseLike<TResult>
  ): DPromise<T | TResult> {
    return this.then(undefined, onRejected)
  }

  finally(cb: () => any): DPromise<T> {
    return this.then(
      val =>
        DPromise.resolve(cb()).then(() => val),
      r =>
        DPromise.resolve(cb()).then(() => { throw r })
    )
  }

  get [Symbol.toStringTag]() {
    return 'DPromise'
  }
}

function resolvePromise<T>(
  promise: DPromise<T>,
  x: any,
  resolve: Resolve<T>,
  reject: Reject
) {
  if (promise === x) {
    return reject(new TypeError("Chaining Cycle Detected."))
  }
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    let called = false
    try {
      const then = x.then
      // thenable
      if (typeof then === 'function') {
        then.call(
          x,
          (y: any) => {
            if (called) return
            called = true
            resolvePromise(promise, y, resolve, reject)
          },
          (r: any) => {
            if (called) return
            called = true
            reject(r)
          }
        )
      } else {
        resolve(x)
      }
    } catch (error) {
      if (called) return
      reject(error)
    }
  } else {
    // 基本数据类型直接resolve
    resolve(x)
  }
}

export default DPromise
