/**
 * Guard & Assert - 类型守卫与断言函数
 */

// --- 基本类型守卫 ---

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export function isNumber(x: unknown): x is number {
  return typeof x === 'number' && !Number.isNaN(x);
}

export function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}

export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function isArray<T>(
  x: unknown,
  guard: (item: unknown) => item is T
): x is T[] {
  return Array.isArray(x) && x.every(guard);
}

// --- 断言函数 ---

export function assertIsString(x: unknown): asserts x is string {
  if (!isString(x)) {
    throw new TypeError(`Expected string, got ${typeof x}`);
  }
}

export function assertIsObject(
  x: unknown
): asserts x is Record<string, unknown> {
  if (!isObject(x)) {
    throw new TypeError(`Expected object, got ${typeof x}`);
  }
}

export function assertHasProperty<K extends string>(
  x: unknown,
  key: K
): asserts x is Record<K, unknown> {
  assertIsObject(x);
  if (!(key in x)) {
    throw new TypeError(`Missing required property: ${key}`);
  }
}

// --- 组合守卫示例 ---

export interface User {
  id: number;
  name: string;
  email?: string;
}

export function isUser(x: unknown): x is User {
  if (!isObject(x)) return false;
  if (!isNumber(x.id)) return false;
  if (!isString(x.name)) return false;
  if ('email' in x && !isString(x.email)) return false;
  return true;
}

export function assertIsUser(x: unknown): asserts x is User {
  assertIsObject(x);
  assertHasProperty(x, 'id');
  if (!isNumber(x.id)) throw new TypeError('User.id must be a number');
  assertHasProperty(x, 'name');
  if (!isString(x.name)) throw new TypeError('User.name must be a string');
  if ('email' in x && !isString(x.email)) {
    throw new TypeError('User.email must be a string');
  }
}
