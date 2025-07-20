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
      if (this.state === PENDING) {
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
  let called = false
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
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
        // 直接resolve
        if (called) return
        called = true
        resolve(x)
      }
    } catch (error) {
      if (called) return
      called = true
      reject(error)
    }
  } else {
    // 基本数据类型直接resolve
    resolve(x)
  }
}