import { describe, it, expect } from 'vitest';
import { string, number, boolean, optional, array, object } from './impl';

describe('Schema Bridge', () => {
  it('validates string', () => {
    expect(string().check('hello')).toBe('hello');
    expect(() => string().check(42)).toThrow(TypeError);
  });

  it('validates number', () => {
    expect(number().check(42)).toBe(42);
    expect(() => number().check(NaN)).toThrow(TypeError);
    expect(() => number().check('42')).toThrow(TypeError);
  });

  it('validates boolean', () => {
    expect(boolean().check(true)).toBe(true);
    expect(() => boolean().check('true')).toThrow(TypeError);
  });

  it('validates optional', () => {
    const schema = optional(string());
    expect(schema.check(undefined)).toBe(undefined);
    expect(schema.check('hi')).toBe('hi');
    expect(() => schema.check(42)).toThrow(TypeError);
  });

  it('validates array', () => {
    const schema = array(number());
    expect(schema.check([1, 2, 3])).toEqual([1, 2, 3]);
    expect(() => schema.check([1, '2', 3])).toThrow('[1]');
    expect(() => schema.check('not array')).toThrow(TypeError);
  });

  it('validates object', () => {
    const UserSchema = object({
      id: number(),
      name: string(),
      active: optional(boolean()),
    });

    const raw = { id: 1, name: 'Alice', active: true };
    const user = UserSchema.check(raw);
    expect(user).toEqual({ id: 1, name: 'Alice', active: true });

    // 类型推导验证（编译期）
    type User = typeof UserSchema.infer;
    const _typeCheck: User = { id: 1, name: 'Bob', active: undefined };

    expect(() => UserSchema.check({ id: '1', name: 'Alice' })).toThrow('.id');
    expect(() => UserSchema.check({ id: 1 })).toThrow('.name');
  });

  it('validates nested object', () => {
    const schema = object({
      user: object({
        id: number(),
        tags: array(string()),
      }),
    });

    const data = {
      user: { id: 1, tags: ['ts', 'js'] },
    };
    expect(schema.check(data)).toEqual(data);
    expect(() =>
      schema.check({ user: { id: 1, tags: ['ts', 42] } })
    ).toThrow('[1]');
  });
});
