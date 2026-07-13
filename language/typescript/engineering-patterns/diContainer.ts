/**
 * 手写 DI Container
 *
 * 考点：
 * - 注册类型/工厂。
 * - 按构造参数自动解析依赖。
 * - 支持 singleton / transient 生命周期。
 */

export type Constructor<T> = new (...args: unknown[]) => T;
export type Factory<T> = () => T;

export class DIContainer {
  private registrations = new Map<symbol | string, { factory: Factory<unknown>; singleton: boolean }>();
  private singletons = new Map<symbol | string, unknown>();

  register<T>(
    token: symbol | string,
    factory: Factory<T>,
    options: { singleton?: boolean } = {}
  ): void {
    this.registrations.set(token, { factory, singleton: options.singleton ?? false });
  }

  resolve<T>(token: symbol | string): T {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`No registration for token ${String(token)}`);
    }

    if (registration.singleton) {
      if (!this.singletons.has(token)) {
        this.singletons.set(token, registration.factory());
      }
      return this.singletons.get(token) as T;
    }

    return registration.factory() as T;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  class Database {
    url = "postgres://localhost";
  }
  class Service {
    constructor(public db: Database) {}
  }

  const container = new DIContainer();
  container.register("db", () => new Database(), { singleton: true });
  container.register("service", () => new Service(container.resolve("db")));

  const service = container.resolve<Service>("service");
  console.log(service.db.url);
}
