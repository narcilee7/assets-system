import { describe, it, expect } from 'vitest';
import {
  isString,
  isNumber,
  isObject,
  isArray,
  isUser,
  assertIsUser,
} from './impl';

describe('type guards', () => {
  it('isString', () => {
    expect(isString('hello')).toBe(true);
    expect(isString(123)).toBe(false);
    expect(isString(null)).toBe(false);
  });

  it('isNumber', () => {
    expect(isNumber(42)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isNumber('42')).toBe(false);
  });

  it('isObject', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
  });

  it('isArray with guard', () => {
    expect(isArray([1, 2, 3], isNumber)).toBe(true);
    expect(isArray([1, '2', 3], isNumber)).toBe(false);
    expect(isArray('not array', isNumber)).toBe(false);
  });

  it('isUser', () => {
    expect(isUser({ id: 1, name: 'Alice' })).toBe(true);
    expect(isUser({ id: 1, name: 'Bob', email: 'bob@example.com' })).toBe(true);
    expect(isUser({ id: '1', name: 'Alice' })).toBe(false);
    expect(isUser({ name: 'Alice' })).toBe(false);
    expect(isUser(null)).toBe(false);
  });
});

describe('assertion functions', () => {
  it('assertIsUser passes for valid user', () => {
    const data: unknown = { id: 1, name: 'Alice' };
    assertIsUser(data);
    // 如果通过断言，data 被收窄为 User
    expect(data.id).toBe(1);
    expect(data.name).toBe('Alice');
  });

  it('assertIsUser throws for invalid data', () => {
    expect(() => assertIsUser(null)).toThrow(TypeError);
    expect(() => assertIsUser({ id: '1', name: 'Alice' })).toThrow(TypeError);
    expect(() => assertIsUser({ name: 'Alice' })).toThrow(TypeError);
  });
});
