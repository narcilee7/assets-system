/**
 * 手写 event bus
 *
 * 考点：
 * - 发布订阅解耦。
 * - 同步 / 异步 handler。
 * - 异常不中断其他 handler。
 */

export type EventHandler<T> = (payload: T) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!;
    const wrapped = handler as EventHandler<unknown>;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        await handler(payload);
      } catch {
        // ignore
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  async function demo() {
    const bus = new EventBus();
    bus.on("user.created", (user) => console.log("created:", user));
    await bus.emit("user.created", { id: 1 });
  }
  demo();
}
