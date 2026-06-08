# 状态分类学

## 1. 六种状态类型

```
┌─────────────────────────────────────────────────────────────┐
│                        应用状态全景                           │
├──────────────┬──────────────────────────────────────────────┤
│  Local State │  useState, useReducer                          │
│              │  只影响单个组件                               │
├──────────────┼──────────────────────────────────────────────┤
│  Global State│  Redux, Zustand, Jotai, Pinia                  │
│              │  跨组件共享                                   │
├──────────────┼──────────────────────────────────────────────┤
│  Server State│  TanStack Query, SWR, Apollo                   │
│              │  来自服务端，有缓存/失效/重试语义               │
├──────────────┼──────────────────────────────────────────────┤
│  URL State   │  query params, route params                    │
│              │  可分享、可书签、可回退                       │
├──────────────┼──────────────────────────────────────────────┤
│  Form State  │  React Hook Form, Formik                       │
│              │  值、校验、错误、 touched、dirty              │
├──────────────┼──────────────────────────────────────────────┤
│  Session     │  localStorage, sessionStorage, cookie          │
│  State       │  跨页面、跨会话持久化                         │
└──────────────┴──────────────────────────────────────────────┘
```

## 2. 分类判断

### Local State

```tsx
// ✅ Local：表单输入、开关状态、hover 状态
function Toggle() {
  const [isOpen, setIsOpen] = useState(false);
  return <button onClick={() => setIsOpen(!isOpen)}>{isOpen ? 'Close' : 'Open'}</button>;
}

// ✅ Local：列表展开/折叠
function AccordionItem({ title, children }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}>{title}</button>
      {expanded && <div>{children}</div>}
    </div>
  );
}
```

### Global State

```tsx
// ❌ 不要：把 Local State 提升到全局
const useStore = create(() => ({ isModalOpen: false }));  // 没必要

// ✅ Global：用户信息、主题、权限
const useUserStore = create(() => ({
  user: null,
  isAuthenticated: false,
  login: async (credentials) => { ... },
  logout: () => { ... },
}));

// ✅ Global：购物车（多页面/多组件共享）
const useCartStore = create(() => ({
  items: [],
  addItem: (product) => { ... },
  removeItem: (id) => { ... },
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
```

### Server State

```tsx
// ❌ 不要：把 API 数据塞到 Redux / Zustand
const useStore = create(() => ({
  posts: [],  // 来自 API，应该有缓存策略
  fetchPosts: async () => { ... },
}));

// ✅ Server State：用 TanStack Query
const { data: posts, isLoading, error } = useQuery({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 5 * 60 * 1000,  // 5 分钟内认为数据新鲜
});

// Server State 的核心特征：
// 1. 数据源在服务端
// 2. 需要缓存（避免重复请求）
// 3. 需要失效策略（何时重新获取）
// 4. 需要乐观更新（mutation 后先更新 UI）
// 5. 需要去重（多个组件请求相同数据）
```

### URL State

```tsx
// ✅ URL State：筛选条件、页码、排序
// /products?category=electronics&sort=price_asc&page=2

function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get('category');
  const sort = searchParams.get('sort');
  const page = Number(searchParams.get('page')) || 1;

  // URL 状态的好处：
  // 1. 刷新页面后状态保留
  // 2. 可以分享链接
  // 3. 浏览器前进/后退正常工作
  // 4. 可以服务端预渲染
}

// ❌ 不要：把 URL 应该管理的状态放到全局 store
const useFilterStore = create(() => ({
  category: null,  // 应该用 URL
  page: 1,         // 应该用 URL
}));
```

### Form State

```tsx
// Form State 的特殊性：值、校验、错误、 touched、dirty、提交状态
// 用专门库管理，不要自己造

import { useForm } from 'react-hook-form';

function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email', { required: 'Email required' })} />
      {errors.email && <span>{errors.email.message}</span>}
      <button disabled={isSubmitting}>Login</button>
    </form>
  );
}
```

### Session State

```tsx
// Session State：持久化到浏览器存储
const useThemeStore = create(
  persist(
    () => ({ theme: 'light' }),
    { name: 'theme-storage', storage: localStorage }
  )
);

// 三种存储方式对比：
// localStorage    : 持久化，跨标签页同步，~5MB
// sessionStorage  : 标签页级别，关闭即清除
// cookie          : 随请求发送，可设过期时间，~4KB
```
