/**
 * 手写 deepClone
 *
 * 考点：
 * - 递归复制对象/数组/Map/Set/Date/RegExp。
 * - 用 WeakMap 解决循环引用。
 * - 保留共享引用关系。
 */

export function deepClone<T>(obj: T, memo: WeakMap<object, unknown> = new WeakMap()): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T;
  }

  if (obj instanceof Map) {
    const cloned = new Map();
    memo.set(obj, cloned);
    for (const [key, value] of obj.entries()) {
      cloned.set(deepClone(key, memo), deepClone(value, memo));
    }
    return cloned as T;
  }

  if (obj instanceof Set) {
    const cloned = new Set();
    memo.set(obj, cloned);
    for (const value of obj.values()) {
      cloned.add(deepClone(value, memo));
    }
    return cloned as T;
  }

  if (memo.has(obj)) {
    return memo.get(obj) as T;
  }

  if (Array.isArray(obj)) {
    const cloned: unknown[] = [];
    memo.set(obj, cloned);
    for (let i = 0; i < obj.length; i++) {
      cloned[i] = deepClone(obj[i], memo);
    }
    return cloned as T;
  }

  const cloned = Object.create(Object.getPrototypeOf(obj));
  memo.set(obj, cloned);
  for (const key of Reflect.ownKeys(obj as object)) {
    const descriptor = Object.getOwnPropertyDescriptor(obj as object, key)!;
    if (descriptor.get || descriptor.set) {
      Object.defineProperty(cloned, key, descriptor);
    } else {
      cloned[key] = deepClone((obj as Record<string | symbol, unknown>)[key], memo);
    }
  }
  return cloned;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data: unknown[] = [1, { name: "ts" }];
  (data as unknown[]).push(data);

  const copied = deepClone(data);
  console.log(copied);
  console.log(copied === data);
  console.log((copied as unknown[])[2] === copied);
}
