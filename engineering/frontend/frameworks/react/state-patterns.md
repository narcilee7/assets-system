# React 状态策略

## 状态分类矩阵

| 类型 | 范围 | 生命周期 | 典型方案 |
|------|------|----------|----------|
| Local State | 单个组件 | 组件挂载期间 | useState / useReducer |
| Lifting State | 父子共享 | 共同祖先存活期间 | props drilling |
| Context | 跨层级共享 | Provider 存活期间 | React Context |
| External Store | 全局共享 | 应用生命周期 | Redux / Zustand / Jotai |
| Server State | 服务端缓存 | 可缓存/可失效 | React Query / SWR |
| URL State | 路由相关 | URL 存活期间 | URL params / query string |

## 1. Local State

```javascript
// 适合：表单输入、UI 开关、临时状态
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

## 2. Lifting State Up

```javascript
// 适合：父子组件共享状态
function Parent() {
  const [value, setValue] = useState('');

  return (
    <>
      <Input value={value} onChange={setValue} />
      <Display value={value} />
    </>
  );
}
```

**Props Drilling 问题**：层级太深时，每层都要传递 props。

## 3. Context

```javascript
// 适合：主题、用户信息、权限、语言等低频变化的全局状态
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}

function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  return <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
    {theme}
  </button>;
}
```

**Context 的性能陷阱**：
- Provider value 变化 → 所有消费组件 re-render
- 解决方案：拆分 Context、使用 `useMemo` 稳定 value、使用状态管理库

## 4. External Store

### Zustand（轻量）

```javascript
import { create } from 'zustand';

const useStore = create((set) => ({
  count: 0,
  user: null,
  increment: () => set((state) => ({ count: state.count + 1 })),
  setUser: (user) => set({ user }),
}));

// 组件中使用（自动订阅，只 re-render 变化的部分）
function Counter() {
  const count = useStore((state) => state.count);
  const increment = useStore((state) => state.increment);
  return <button onClick={increment}>{count}</button>;
}
```

### Jotai（原子化）

```javascript
import { atom, useAtom } from 'jotai';

const countAtom = atom(0);
const doubledAtom = atom((get) => get(countAtom) * 2);  // 派生 atom

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  const [doubled] = useAtom(doubledAtom);

  return (
    <div>
      <p>{count} × 2 = {doubled}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
```

## 5. Server State

```javascript
// React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000,  // 5 分钟内不重新请求
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <ul>{data.map(user => <li key={user.id}>{user.name}</li>)}</ul>;
}

function CreateUser() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      // 成功后失效 users 缓存，触发重新获取
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return <button onClick={() => mutation.mutate({ name: 'New User' })}>
    Create
  </button>;
}
```

## 6. 选择决策树

```
状态需要共享吗？
  ├─ 不需要 → useState / useReducer
  │
  └─ 需要 → 共享范围多大？
      ├─ 父子组件 → Lifting State Up
      │
      ├─ 跨多层组件 → Context（低频变化）/ External Store（高频变化）
      │
      ├─ 服务端数据 → React Query / SWR
      │
      └─ URL 相关 → URL State（可刷新、可分享）
```
