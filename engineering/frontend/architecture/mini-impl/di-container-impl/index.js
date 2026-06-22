const RegisterItemLifecycle = {
  TRANSIENT: "transient",
  SINGLETON: "singleton",
  SCOPE: "scope",
};

class DIContainer {
  constructor() {
    this.registrations = new Map();
    this.singletons = new Map();
    this.scopeInstances = new Map();
    this.resolutionStack = [];
  }

  register(token, factory) {
    this.registrations.set(token, {
      factory,
      lifecycle: RegisterItemLifecycle.TRANSIENT,
    });
    return this;
  }

  // singleton: 全局唯一的实例
  registerSingleton(token, factory) {
    this.registrations.set(token, {
      factory,
      lifecycle: RegisterItemLifecycle.SINGLETON,
    });
    return this;
  }

  // scope: 每个请求/作用域有唯一的实例
  registerScope(token, factory) {
    this.registrations.set(token, {
      factory,
      lifecycle: RegisterItemLifecycle.SCOPE,
    });
    return this;
  }

  // 注册类
  registerClass(token, Class, lifecycle = RegisterItemLifecycle.TRANSIENT) {
    // const factory = () => this._createInstance(Class);
    this.registrations.set(token, {
      factory: () => this._createInstance(Class),
      lifecycle,
    });
    return this;
  }

  resolve(token, scopeId = null) {
    if (this.resolutionStack.includes(token)) {
      const cycle = this.resolutionStack.slice(
        this.resolutionStack.indexOf(token),
      );
      cycle.push(token);
      throw new Error(`检测到有循环依赖: ${cycle.join(" -> ")}`);
    }

    const registration = this.registrations.get(token);
    if (!registration) {
      // 尝试作为类进行解析
      if (typeof token === "function") {
        return this._createInstance(token);
      }
      throw new Error(`未找到注册项: ${token}`);
    }

    // singleton
    if (registration.lifecycle === RegisterItemLifecycle.SINGLETON) {
      if (this.singletons.has(token)) {
        return this.singletons.get(token);
      }
      // TODO：这里是不是得处理 OR 报错
    }

    // scoped
    if (registration.lifecycle === RegisterItemLifecycle.SCOPE && scopeId) {
      const scope = this.scopeInstances.get(scopeId);
      if (scope && scope.has(token)) {
        return scope.get(token);
      }
      // TODO：这里是不是得处理 OR 报错
    }

    this.resolutionStack.push(token);
    let instance;

    try {
      instance = registration.factory();
    } finally {
      this.resolutionStack.pop();
    }

    // cache single ton
    if (registration.lifecycle === RegisterItemLifecycle.SINGLETON) {
      this.singletons.set(token, instance);
    }

    // cache scope
    if (registration.lifecycle === RegisterItemLifecycle.SCOPE && scopeId) {
      const scope = this.scopeInstances.get(scopeId);
      if (!scope) {
        this.scopeInstances.set(scopeId, new Map());
      }
      this.scopeInstances.get(scopeId).set(token, instance);
    }

    return instance;
  }

  createScope() {
    const scopeId = Symbol("scope");
    return {
      resolve: (token) => this.resolve(token, scopeId),
      dispose: () => this.scopeInstances.delete(scopeId),
    };
  }

  _createInstance(Class) {
    // TODO: Pre Valide 判断构造函数
    const paramTypes = Class.__inject || [];

    if (paramTypes.length === 0) {
      return new Class();
    }

    const args = paramTypes.map((paramToken) => this.resolve(paramToken));

    return new Class(...args);
  }

  static Inject(...tokens) {
    return function (target) {
      target.__inject = tokens;
      return target;
    };
  }
}
