# 前端架构模式

## 1. 分层架构

```
经典三层架构：

Presentation Layer（表现层）
  ├── UI Components（React/Vue 组件）
  ├── Pages（页面组装）
  └── Hooks/Composables（组件逻辑）

Business Logic Layer（业务逻辑层）
  ├── Services（业务服务）
  ├── Use Cases（用例/交互）
  └── Domain Models（领域模型）

Data Access Layer（数据访问层）
  ├── API Clients（HTTP 客户端）
  ├── Repositories（数据仓库）
  └── Cache/Middleware（缓存/中间件）
```

```typescript
// Clean Architecture 变体（依赖方向：内层不依赖外层）
// src/
//   domain/          ← 最内层：实体、值对象、领域服务
//   application/     ← 用例、端口（接口定义）
//   infrastructure/  ← 外层：API 实现、存储实现
//   presentation/    ← 最外层：UI 组件

// domain/entities/User.ts
interface User {
  id: string;
  name: string;
  email: string;
}

// application/ports/UserRepository.ts
interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// application/usecases/GetUser.ts
class GetUserUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }
}

// infrastructure/repositories/HttpUserRepository.ts
class HttpUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const res = await fetch(`/api/users/${id}`);
    return res.ok ? res.json() : null;
  }

  async save(user: User): Promise<void> {
    await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  }
}

// presentation/hooks/useUser.ts
function useUser(id: string) {
  const userRepo = useContainer().get(UserRepository);
  const getUser = new GetUserUseCase(userRepo);

  return useQuery({
    queryKey: ['user', id],
    queryFn: () => getUser.execute(id),
  });
}
```

## 2. MVC / MVVM / MVP

| 模式 | View 职责 | 逻辑位置 | 数据绑定 | 适用场景 |
|------|----------|---------|---------|---------|
| **MVC** | 被动，等待 Controller 更新 | Controller | 手动 | 传统服务端渲染 |
| **MVP** | 被动，通过 Presenter 交互 | Presenter | 手动 | 测试优先 |
| **MVVM** | 主动，双向绑定 ViewModel | ViewModel | 自动 | 现代框架（Vue/React） |

```typescript
// MVVM 在 React 中的体现
// ViewModel = Hook/自定义 Hook

function useCounterViewModel() {
  const [count, setCount] = useState(0);

  const increment = () => setCount((c) => c + 1);
  const decrement = () => setCount((c) => c - 1);
  const double = useMemo(() => count * 2, [count]);

  return { count, double, increment, decrement };
}

// View = Component
function CounterView() {
  const vm = useCounterViewModel();

  return (
    <div>
      <p>Count: {vm.count}</p>
      <p>Double: {vm.double}</p>
      <button onClick={vm.increment}>+</button>
      <button onClick={vm.decrement}>-</button>
    </div>
  );
}
```

## 3. Feature-Based 架构

```
src/
├── features/
│   ├── auth/
│   │   ├── api/              ← API 调用
│   │   ├── components/       ← UI 组件
│   │   ├── hooks/            ← 业务 Hooks
│   │   ├── stores/           ← 状态管理
│   │   ├── types.ts          ← 类型定义
│   │   └── index.ts          ← 公开 API
│   │
│   ├── cart/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── index.ts
│   │
│   └── checkout/
│       └── ...
│
├── shared/                   ← 共享基础设施
│   ├── components/           ← 通用 UI 组件
│   ├── lib/                  ← 工具函数
│   ├── hooks/                ← 通用 Hooks
│   └── types/                ← 全局类型
│
└── app/                      ← 应用入口
    ├── router.tsx
    ├── providers.tsx
    └── main.tsx
```

```typescript
// features/auth/index.ts
// 公开 API：其他 feature 只能通过这里访问 auth

export { LoginForm } from './components/LoginForm';
export { useAuth } from './hooks/useAuth';
export { authStore } from './stores/authStore';
export type { User, AuthState } from './types';

// features/cart/components/CartButton.tsx
// 跨 feature 引用通过 index.ts
import { useAuth } from '@/features/auth';

export function CartButton() {
  const { isAuthenticated } = useAuth();
  // ...
}
```

## 4. 架构原则

### SOLID 在前端中的应用

| 原则 | 含义 | 前端实践 |
|------|------|---------|
| **S**ingle Responsibility | 单一职责 | 一个组件只做一件事 |
| **O**pen/Closed | 开闭原则 | 通过 Props/Slots 扩展，不修改源码 |
| **L**iskov Substitution | 里氏替换 | 子组件可以替换父组件的插槽内容 |
| **I**nterface Segregation | 接口隔离 | 细粒度 Hooks，不强迫依赖不需要的功能 |
| **D**ependency Inversion | 依赖倒置 | 依赖抽象（接口/类型），不依赖具体实现 |

### 其他重要原则

```typescript
// DRY（Don't Repeat Yourself）
// ❌ 重复
function UserCard({ user }) {
  return <div>{user.name} - {user.email}</div>;
}
function AdminCard({ admin }) {
  return <div>{admin.name} - {admin.email}</div>;
}

// ✅ 抽象
function PersonCard({ name, email, role }) {
  return <div>{name} - {email} {role && `(${role})`}</div>;
}

// KISS（Keep It Simple, Stupid）
// ❌ 过度抽象
const withDataFetching = (Component) => (url) => {
  return function Wrapped(props) {
    const [data, setData] = useState(null);
    // ... 复杂逻辑
    return <Component {...props} data={data} />;
  };
};

// ✅ 简单直接
function UserList() {
  const { data } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  return <ul>{data?.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```
