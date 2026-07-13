/**
 * 手写 mini pub/sub
 *
 * 考点：
 * - 通配符匹配（* 单段，# 多段）。
 * - 异步订阅者与错误隔离。
 * - 订阅注销 token。
 */

export type PubSubHandler<T = unknown> = (data: T, topic: string) => void | Promise<void>;

interface Subscription<T = unknown> {
  id: number;
  pattern: string;
  handler: PubSubHandler<T>;
}

export class MiniPubSub {
  private subscriptions: Subscription[] = [];
  private idCounter = 0;

  subscribe<T>(pattern: string, handler: PubSubHandler<T>): () => void {
    const id = ++this.idCounter;
    const sub: Subscription = { id, pattern, handler: handler as PubSubHandler<unknown> };
    this.subscriptions.push(sub);
    return () => {
      const idx = this.subscriptions.findIndex((s) => s.id === id);
      if (idx !== -1) this.subscriptions.splice(idx, 1);
    };
  }

  async publish<T>(topic: string, data: T): Promise<void> {
    const matched = this.subscriptions.filter((sub) => this.match(sub.pattern, topic));
    await Promise.all(
      matched.map(async (sub) => {
        try {
          await sub.handler(data, topic);
        } catch (error) {
          // isolate subscriber errors
        }
      })
    );
  }

  private match(pattern: string, topic: string): boolean {
    const patternParts = pattern.split(".");
    const topicParts = topic.split(".");
    let pi = 0;
    let ti = 0;

    while (pi < patternParts.length && ti < topicParts.length) {
      const part = patternParts[pi];
      if (part === "#") return true;
      if (part !== "*" && part !== topicParts[ti]) return false;
      pi++;
      ti++;
    }

    return pi === patternParts.length && ti === topicParts.length;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bus = new MiniPubSub();
  bus.subscribe("user.*.created", (data, topic) => console.log(topic, data));
  bus.publish("user.123.created", { id: 123 });
}
