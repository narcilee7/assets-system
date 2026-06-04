import { describe, it, expect, vi } from 'vitest';
import { TypedEventEmitter } from './impl';

interface MyEvents {
  login: { userId: string; timestamp: number };
  logout: { userId: string };
  message: string;
}

describe('TypedEventEmitter', () => {
  it('on and emit', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    const handler = vi.fn();

    emitter.on('login', handler);
    emitter.emit('login', { userId: 'u1', timestamp: Date.now() });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' })
    );
  });

  it('multiple listeners', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();

    emitter.on('message', h1);
    emitter.on('message', h2);
    emitter.emit('message', 'hello');

    expect(h1).toHaveBeenCalledWith('hello');
    expect(h2).toHaveBeenCalledWith('hello');
  });

  it('off removes listener', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    const handler = vi.fn();

    emitter.on('logout', handler);
    emitter.off('logout', handler);
    emitter.emit('logout', { userId: 'u1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('once only fires once', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    const handler = vi.fn();

    emitter.once('message', handler);
    emitter.emit('message', 'first');
    emitter.emit('message', 'second');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('returned unsubscribe works', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    const handler = vi.fn();

    const unsub = emitter.on('login', handler);
    unsub();
    emitter.emit('login', { userId: 'u1', timestamp: 0 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('listenerCount', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    expect(emitter.listenerCount('login')).toBe(0);

    const h1 = () => {};
    const h2 = () => {};
    emitter.on('login', h1);
    expect(emitter.listenerCount('login')).toBe(1);
    emitter.on('login', h2);
    expect(emitter.listenerCount('login')).toBe(2);
    emitter.off('login', h1);
    expect(emitter.listenerCount('login')).toBe(1);
  });

  it('removeAllListeners', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    const handler = vi.fn();

    emitter.on('login', handler);
    emitter.on('logout', handler);
    emitter.removeAllListeners();
    emitter.emit('login', { userId: 'u1', timestamp: 0 });
    emitter.emit('logout', { userId: 'u1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('emit with no listeners does not throw', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    expect(() =>
      emitter.emit('message', 'no one is listening')
    ).not.toThrow();
  });

  it('listener error does not block others', () => {
    const emitter = new TypedEventEmitter<MyEvents>();
    const errorHandler = vi.fn(() => {
      throw new Error('boom');
    });
    const normalHandler = vi.fn();

    emitter.on('message', errorHandler);
    emitter.on('message', normalHandler);

    // 不抛错到外部
    expect(() => emitter.emit('message', 'test')).not.toThrow();
    expect(normalHandler).toHaveBeenCalled();
  });
});
