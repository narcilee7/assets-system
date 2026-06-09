# 状态架构模式

## 1. 状态分层

```
┌─────────────────────────────────────┐
│           Presentation Layer         │
│  Components / UI State (Local)       │
├─────────────────────────────────────┤
│           Domain Layer               │
│  Global State (Zustand / Redux)      │
│  - User, Cart, Settings              │
├─────────────────────────────────────┤
│           API Layer                  │
│  Server State (TanStack Query)       │
│  - Posts, Comments, Products         │
├─────────────────────────────────────┤
│           Infrastructure             │
│  Persistence / Sync / Transport      │
└─────────────────────────────────────┘
```

## 2. 模块组织（Feature-based）

```
src/
├── features/
│   ├── posts/
│   │   ├── api/
│   │   │   ├── getPosts.ts       # TanStack Query hooks
│   │   │   └── createPost.ts
│   │   ├── store/
│   │   │   └── postStore.ts      # Zustand store（本地状态）
│   │   ├── components/
│   │   └── types.ts
│   │
│   ├── cart/
│   │   ├── api/
│   │   ├── store/
│   │   │   └── cartStore.ts
│   │   └── components/
│   │
│   └── user/
│       ├── api/
│       ├── store/
│       └── components/
│
├── shared/
│   ├── stores/
│   │   └── uiStore.ts            # 跨 feature 的 UI 状态
│   └── api/
│       └── queryClient.ts        # TanStack Query client 配置
```

## 3. 跨组件通信模式

### 模式一：Lift State Up（父子）

```tsx
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <ChildA count={count} />
      <ChildB onIncrement={() => setCount((c) => c + 1)} />
    </div>
  );
}
```

### 模式二：Global Store（跨层级）

```tsx
// 适用于：用户状态、主题、购物车
const useUserStore = create(() => ({ user: null }));

// 任意层级组件都能访问
function DeepNestedComponent() {
  const user = useUserStore((s) => s.user);
  return <div>{user?.name}</div>;
}
```

### 模式三：Event Bus（解耦通信）

```ts
// 适用于：不相关的组件间通信，但需谨慎使用
class EventBus {
  private events = new Map<string, Set<(...args: any[]) => void>>();

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event)!.add(callback);
    return () => this.events.get(event)?.delete(callback);
  }

  emit(event: string, ...args: any[]) {
    this.events.get(event)?.forEach((cb) => cb(...args));
  }
}

const bus = new EventBus();

// 组件 A
bus.on('cart:updated', (items) => console.log(items));

// 组件 B
bus.emit('cart:updated', newItems);
```

### 模式四：Pub/Sub with Context

```tsx
// 适用于：模块内组件通信
const PostContext = createContext(null);

function PostProvider({ postId, children }) {
  const [comments, setComments] = useState([]);
  const addComment = (comment) => setComments((c) => [...c, comment]);

  return (
    <PostContext.Provider value={{ postId, comments, addComment }}>
      {children}
    </PostContext.Provider>
  );
}
```

## 4. 微前端状态共享

```ts
// 方式一：Shared Module Federation（运行时共享）
// webpack.config.js
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      shared: {
        zustand: { singleton: true, requiredVersion: '^4.0.0' },
      },
    }),
  ],
};

// 方式二：Custom Event + Storage
// app1 和 app2 通过 localStorage + storage event 同步
window.dispatchEvent(new StorageEvent('storage', {
  key: 'shared-state',
  newValue: JSON.stringify({ user: newUser }),
}));

// 方式三：Shared Worker（高级）
// 多个微前端共享一个 Worker 管理状态
```
