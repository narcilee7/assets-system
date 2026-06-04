/**
 * TypedEventEmitter - 类型安全的事件发布订阅
 */

export class TypedEventEmitter<Events extends Record<string, any>> {
  private listeners = new Map<
    keyof Events,
    Set<(payload: Events[keyof Events]) => void>
  >();

  on<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    // 由于 TS 无法保证 Events[K] 和 Events[keyof Events] 完全一致，这里做类型断言
    set.add(listener as (payload: Events[keyof Events]) => void);

    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as (payload: Events[keyof Events]) => void);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  once<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void
  ): void {
    const wrapper = (payload: Events[K]) => {
      this.off(event, wrapper);
      listener(payload);
    };
    this.on(event, wrapper);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((listener) => {
      try {
        listener(payload);
      } catch (e) {
        // 防止某个监听器抛错阻塞其他监听器
        console.error(`Error in event listener for ${String(event)}:`, e);
      }
    });
  }

  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(event);
    }
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
