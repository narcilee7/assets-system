# Angular 依赖注入

## 1. 核心概念

Angular 的 DI（Dependency Injection）不是库，而是**框架级的基础设施**：

```typescript
// 服务定义
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient) {}
  getUser(id: number) {
    return this.http.get(`/api/users/${id}`);
  }
}

// 组件中使用
@Component({
  selector: 'app-user-profile',
  template: `<div>{{ user.name }}</div>`
})
export class UserProfileComponent {
  constructor(private userService: UserService) {}
}
```

## 2. Injector 树

Angular 的 Injector 是**组件树级别的层级结构**：

```
AppModule Injector (root)
    │
    ├── AppComponent Injector
    │   ├── HeaderComponent Injector ── UserService（覆写 root 实例）
    │   └── DashboardComponent Injector
    │       ├── WidgetAComponent ── UserService（继承 Dashboard）
    │       └── WidgetBComponent
    │
    └── AdminModule Injector（懒加载模块）
        └── AdminService
```

### 解析规则

1. 组件请求依赖时，先从**自己的 Injector** 查找
2. 找不到，向上查找**父组件的 Injector**
3. 一直找到 **root Injector**（AppModule）
4. 还找不到，报错 `NullInjectorError`

## 3. Provider 配置

```typescript
// 1. 类 Provider
{ provide: UserService, useClass: UserService }  // 简写: UserService

// 2. 值 Provider
{ provide: API_URL, useValue: 'https://api.example.com' }

// 3. 工厂 Provider
{ provide: DatabaseService, useFactory: (config: Config) => {
  return config.production ? new PostgresService() : new SQLiteService();
}, deps: [Config] }

// 4. 别名 Provider
{ provide: OldService, useExisting: NewService }
```

## 4. 生命周期与作用域

| Provider 位置 | 作用域 | 生命周期 |
|--------------|--------|----------|
| `providedIn: 'root'` | 全局单例 | 应用启动到结束 |
| Module providers | 模块级 | 模块加载到卸载 |
| Component providers | 组件级 | 组件创建到销毁 |

## 5. Tree-shakable Provider

```typescript
// Angular 6+ 支持 tree-shakable providers
@Injectable({ providedIn: 'root' })  // 未被注入则打包时摇掉
export class OptionalService {}

// 旧方式（不能 tree-shake）
@NgModule({ providers: [OldService] })  // 即使未使用也会被打包
export class AppModule {}
```
