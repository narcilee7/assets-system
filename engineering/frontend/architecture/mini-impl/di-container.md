# 手写依赖注入容器

## 目标

实现一个简化版依赖注入容器，支持：
1. 注册（Register）与解析（Resolve）
2. 生命周期管理（Transient/Singleton/Scoped）
3. 构造函数注入
4. 循环依赖检测

## 实现

```javascript
// di-container.js

class DIContainer {
  constructor() {
    this.registrations = new Map();  // token → registration
    this.singletons = new Map();     // token → instance
    this.scopedInstances = new Map(); // scopeId → Map(token, instance)
    this.resolutionStack = [];       // 用于循环依赖检测
  }

  // ========== 注册 API ==========

  // Transient：每次解析创建新实例
  register(token, factory) {
    this.registrations.set(token, {
      factory,
      lifecycle: 'transient',
    });
    return this;
  }

  // Singleton：全局唯一实例
  registerSingleton(token, factory) {
    this.registrations.set(token, {
      factory,
      lifecycle: 'singleton',
    });
    return this;
  }

  // Scoped：每个作用域唯一实例
  registerScoped(token, factory) {
    this.registrations.set(token, {
      factory,
      lifecycle: 'scoped',
    });
    return this;
  }

  // 注册类（自动解析构造函数参数）
  registerClass(token, Class, lifecycle = 'transient') {
    const factory = () => this._createInstance(Class);
    this.registrations.set(token, { factory, lifecycle, Class });
    return this;
  }

  // 注册实例（已创建的对象）
  registerInstance(token, instance) {
    this.singletons.set(token, instance);
    this.registrations.set(token, {
      factory: () => instance,
      lifecycle: 'singleton',
    });
    return this;
  }

  // ========== 解析 API ==========

  resolve(token, scopeId = null) {
    // 循环依赖检测
    if (this.resolutionStack.includes(token)) {
      const cycle = this.resolutionStack.slice(
        this.resolutionStack.indexOf(token)
      );
      cycle.push(token);
      throw new Error(`Circular dependency detected: ${cycle.join(' → ')}`);
    }

    const registration = this.registrations.get(token);
    if (!registration) {
      // 尝试作为类直接解析
      if (typeof token === 'function') {
        return this._createInstance(token);
      }
      throw new Error(`Service '${token}' not registered`);
    }

    // Singleton
    if (registration.lifecycle === 'singleton') {
      if (this.singletons.has(token)) {
        return this.singletons.get(token);
      }
    }

    // Scoped
    if (registration.lifecycle === 'scoped' && scopeId) {
      const scope = this.scopedInstances.get(scopeId);
      if (scope && scope.has(token)) {
        return scope.get(token);
      }
    }

    // 创建实例
    this.resolutionStack.push(token);
    let instance;

    try {
      instance = registration.factory();
    } finally {
      this.resolutionStack.pop();
    }

    // 缓存 Singleton
    if (registration.lifecycle === 'singleton') {
      this.singletons.set(token, instance);
    }

    // 缓存 Scoped
    if (registration.lifecycle === 'scoped' && scopeId) {
      if (!this.scopedInstances.has(scopeId)) {
        this.scopedInstances.set(scopeId, new Map());
      }
      this.scopedInstances.get(scopeId).set(token, instance);
    }

    return instance;
  }

  // 创建作用域
  createScope() {
    const scopeId = Symbol('scope');
    return {
      resolve: (token) => this.resolve(token, scopeId),
      dispose: () => this.scopedInstances.delete(scopeId),
    };
  }

  // ========== 内部方法 ==========

  _createInstance(Class) {
    // 解析构造函数参数（通过 @Inject 装饰器或参数类型）
    const paramTypes = Class.__inject || [];

    if (paramTypes.length === 0) {
      return new Class();
    }

    const args = paramTypes.map((paramToken) => this.resolve(paramToken));
    return new Class(...args);
  }

  // 装饰器：标记注入参数
  static Inject(...tokens) {
    return function (target) {
      target.__inject = tokens;
      return target;
    };
  }
}

// ========== 使用示例 ==========

// 定义接口（用 Symbol 或字符串）
const ILogger = Symbol('ILogger');
const IDatabase = Symbol('IDatabase');
const IUserService = Symbol('IUserService');

// 实现类
class ConsoleLogger {
  log(msg) { console.log(`[LOG] ${msg}`); }
}

class MockDatabase {
  constructor(logger) {
    this.logger = logger;
  }
  query(sql) {
    this.logger.log(`Query: ${sql}`);
    return [];
  }
}

// 使用装饰器标记依赖
class UserService {
  constructor(logger, db) {
    this.logger = logger;
    this.db = db;
  }

  getUsers() {
    this.logger.log('Getting users');
    return this.db.query('SELECT * FROM users');
  }
}
UserService.__inject = [ILogger, IDatabase];

// 配置容器
const container = new DIContainer();

container
  .registerSingleton(ILogger, () => new ConsoleLogger())
  .registerSingleton(IDatabase, () => {
    const logger = container.resolve(ILogger);
    return new MockDatabase(logger);
  })
  .registerClass(IUserService, UserService, 'transient');

// 解析
const userService = container.resolve(IUserService);
userService.getUsers();

// Singleton 验证
const logger1 = container.resolve(ILogger);
const logger2 = container.resolve(ILogger);
console.log(logger1 === logger2);  // true

// Scoped 验证
const scope1 = container.createScope();
const scope2 = container.createScope();

container.registerScoped('requestId', () => Math.random().toString(36));

const id1a = scope1.resolve('requestId');
const id1b = scope1.resolve('requestId');
const id2a = scope2.resolve('requestId');

console.log(id1a === id1b);  // true（同一 scope）
console.log(id1a === id2a);  // false（不同 scope）

// 循环依赖检测
const IA = Symbol('IA');
const IB = Symbol('IB');

class ServiceA {
  constructor(b) { this.b = b; }
}
ServiceA.__inject = [IB];

class ServiceB {
  constructor(a) { this.a = a; }
}
ServiceB.__inject = [IA];

container.registerClass(IA, ServiceA);
container.registerClass(IB, ServiceB);

try {
  container.resolve(IA);
} catch (e) {
  console.log(e.message);  // Circular dependency detected: Symbol(IA) → Symbol(IB) → Symbol(IA)
}

module.exports = { DIContainer };
```
