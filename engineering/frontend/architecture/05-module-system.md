# 模块系统

## 1. 依赖注入（DI）

```typescript
// 依赖注入：组件不创建依赖，由外部提供

// ❌ 紧耦合
class UserService {
  private api = new HttpApiClient();  // 硬编码依赖
}

// ✅ 依赖注入
interface ApiClient {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, data: unknown): Promise<T>;
}

class UserService {
  constructor(private api: ApiClient) {}

  async getUser(id: string): Promise<User> {
    return this.api.get(`/users/${id}`);
  }
}

// 容器注册
class DIContainer {
  private services = new Map<string, any>();

  register<T>(token: string, factory: () => T): void {
    this.services.set(token, { factory, instance: null });
  }

  registerSingleton<T>(token: string, factory: () => T): void {
    this.services.set(token, { factory, singleton: true, instance: null });
  }

  resolve<T>(token: string): T {
    const service = this.services.get(token);
    if (!service) throw new Error(`Service ${token} not registered`);

    if (service.singleton) {
      if (!service.instance) {
        service.instance = service.factory();
      }
      return service.instance;
    }

    return service.factory();
  }
}

// 使用
const container = new DIContainer();

container.registerSingleton<ApiClient>('api', () => new FetchApiClient());
container.register('userService', () => new UserService(container.resolve('api')));

const userService = container.resolve<UserService>('userService');
```

## 2. 控制反转（IoC）

```typescript
// 插件系统：核心框架不依赖插件，插件依赖框架

interface Plugin {
  name: string;
  install(app: App): void;
}

class App {
  private plugins = new Map<string, Plugin>();
  private hooks = new Map<string, Function[]>();

  use(plugin: Plugin) {
    this.plugins.set(plugin.name, plugin);
    plugin.install(this);
  }

  hook(name: string, fn: Function) {
    if (!this.hooks.has(name)) this.hooks.set(name, []);
    this.hooks.get(name)!.push(fn);
  }

  async runHook(name: string, ...args: any[]) {
    const hooks = this.hooks.get(name) || [];
    for (const fn of hooks) {
      await fn(...args);
    }
  }
}

// 插件实现
const loggerPlugin: Plugin = {
  name: 'logger',
  install(app) {
    app.hook('before:request', (req) => {
      console.log('[Request]', req.url);
    });
    app.hook('after:request', (res) => {
      console.log('[Response]', res.status);
    });
  },
};

const analyticsPlugin: Plugin = {
  name: 'analytics',
  install(app) {
    app.hook('route:change', (to) => {
      gtag('event', 'page_view', { page_path: to });
    });
  },
};

// 使用
const app = new App();
app.use(loggerPlugin);
app.use(analyticsPlugin);
```

## 3. 模块化策略

```typescript
//  Barrel 导出模式
// features/auth/index.ts
export { LoginForm } from './components/LoginForm';
export { useAuth } from './hooks/useAuth';
export { authGuard } from './guards/authGuard';
export type { User, AuthState } from './types';

// 严格封装：feature 内部文件不直接暴露
// features/auth/internals/crypto.ts  ← 不导出

// 依赖规则（使用 ESLint 强制）
// .eslintrc.js
module.exports = {
  rules: {
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          // features 不能导入其他 features 的内部
          {
            target: './src/features',
            from: './src/features/*/internals',
            message: 'Cannot import internals from other features',
          },
          // shared 不能导入 features
          {
            target: './src/shared',
            from: './src/features',
            message: 'Shared cannot depend on features',
          },
        ],
      },
    ],
  },
};
```

## 4. 微内核架构

```typescript
// 微内核：核心极简，功能通过扩展点添加

interface ExtensionPoint {
  name: string;
  handlers: Function[];
}

class MicroKernel {
  private extensions = new Map<string, ExtensionPoint>();

  registerExtensionPoint(name: string) {
    this.extensions.set(name, { name, handlers: [] });
  }

  extend(pointName: string, handler: Function) {
    const point = this.extensions.get(pointName);
    if (!point) throw new Error(`Extension point ${pointName} not found`);
    point.handlers.push(handler);
  }

  async invoke(pointName: string, ...args: any[]) {
    const point = this.extensions.get(pointName);
    if (!point) return;

    for (const handler of point.handlers) {
      await handler(...args);
    }
  }
}

// 实现一个可扩展的表单验证框架
class FormFramework {
  private kernel = new MicroKernel();

  constructor() {
    this.kernel.registerExtensionPoint('validators');
    this.kernel.registerExtensionPoint('renderers');
    this.kernel.registerExtensionPoint('transformers');
  }

  addValidator(validator: Validator) {
    this.kernel.extend('validators', validator);
  }

  addRenderer(renderer: Renderer) {
    this.kernel.extend('renderers', renderer);
  }

  async validate(value: unknown, rules: Rule[]) {
    const errors: string[] = [];
    await this.kernel.invoke('validators', value, rules, errors);
    return errors;
  }
}
```
