# React Suspense

## 1. Suspense 的本质

Suspense 是 React 的**异步边界**机制：当组件需要等待异步数据时，React 暂停该子树的渲染，显示 fallback UI，数据到达后继续渲染。

```jsx
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile />      {/* 内部会发起数据请求 */}
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments />       {/* 独立的 Suspense 边界 */}
      </Suspense>
    </Suspense>
  );
}
```

## 2. Suspense 与数据获取

### 传统方式（useEffect + useState）

```javascript
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  if (!user) return <Spinner />;  // 每个组件自己处理 loading

  return <div>{user.name}</div>;
}
```

**问题**：
- 每个组件独立处理 loading，无法统一控制
- 子组件数据获取串行（子组件 mount 后才请求）
- 无法优雅处理错误

### Suspense 方式

```javascript
// 包装数据请求为 Throw Promise 模式
function wrapPromise(promise) {
  let status = 'pending';
  let result;

  const suspender = promise.then(
    (r) => { status = 'success'; result = r; },
    (e) => { status = 'error'; result = e; }
  );

  return {
    read() {
      if (status === 'pending') throw suspender;    // 抛出 Promise，React 捕获
      if (status === 'error') throw result;         // 抛出错误，ErrorBoundary 捕获
      return result;                                // 返回数据
    },
  };
}

// 数据缓存层
const userCache = new Map();

function getUser(userId) {
  if (!userCache.has(userId)) {
    userCache.set(userId, wrapPromise(fetchUser(userId)));
  }
  return userCache.get(userId);
}

// 组件中使用
function UserProfile({ userId }) {
  const user = getUser(userId).read();  // 要么返回数据，要么 throw Promise
  return <div>{user.name}</div>;
}
```

## 3. Error Boundary

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

// 使用
<ErrorBoundary fallback={(error) => <ErrorMessage error={error} />}>
  <Suspense fallback={<Spinner />}>
    <UserProfile />
  </Suspense>
</ErrorBoundary>
```

**错误处理流程**：
1. 组件 render 时 throw Promise → React 捕获 → 显示最近的 Suspense fallback
2. Promise resolve → React 重新 render → 显示真实 UI
3. 组件 render 时 throw Error → React 向上查找最近的 ErrorBoundary → 显示 error fallback

## 4. 嵌套 Suspense

```jsx
function App() {
  return (
    <ErrorBoundary fallback={<GlobalError />}>
      <Suspense fallback={<GlobalSpinner />}>
        <Layout>
          <Nav />
          <main>
            <Suspense fallback={<PageSkeleton />}>
              <PageContent />
            </Suspense>
          </main>
          <Suspense fallback={<SidebarSkeleton />}>
            <Sidebar />
          </Suspense>
        </Layout>
      </Suspense>
    </ErrorBoundary>
  );
}
```

**嵌套规则**：
- 子 Suspense 的 fallback 优先于父 Suspense
- 如果子组件全部 resolve，但父还在 loading，父的 fallback 会覆盖
- 建议每个数据获取组件包一层 Suspense，避免单个慢请求阻塞整个页面
