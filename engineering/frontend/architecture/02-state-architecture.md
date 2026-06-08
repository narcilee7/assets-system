# 状态架构设计

## 1. 状态分类

```
状态类型：

Server State（服务端状态）
  ├── 来源：API 响应
  ├── 特点：异步、不可控、需要缓存/同步
  └── 管理：TanStack Query / SWR / RTK Query

UI State（UI 状态）
  ├── 来源：用户交互
  ├── 特点：同步、本地、临时
  └── 管理：useState / useReducer / Context

Form State（表单状态）
  ├── 来源：用户输入
  ├── 特点：脏检查、验证、错误提示
  └── 管理：React Hook Form / Formik

URL State（URL 状态）
  ├── 来源：路由参数
  ├── 特点：可分享、可回溯
  └── 管理：React Router / 查询参数

Global State（全局状态）
  ├── 来源：应用级共享数据
  ├── 特点：跨组件、持久化需求
  └── 管理：Zustand / Redux / Jotai
```

## 2. 状态位置决策

```typescript
// 状态应该放在哪里？

// 1. 组件内部（最小范围）
function Toggle() {
  const [isOn, setIsOn] = useState(false);  // 只有 Toggle 关心
  return <button onClick={() => setIsOn(!isOn)}>{isOn ? 'ON' : 'OFF'}</button>;
}

// 2. 父子组件（状态提升）
function Parent() {
  const [value, setValue] = useState('');  // 兄弟组件共享
  return (
    <>
      <Input value={value} onChange={setValue} />
      <Display value={value} />
    </>
  );
}

// 3. Context（跨层级但范围有限）
const ThemeContext = createContext('light');

// 4. 全局 Store（应用级共享）
const useUserStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

// 5. URL（需要可分享的状态）
// /search?q=react&page=2 → 搜索词和页码在 URL 中
```

## 3. 状态机（State Machine）

```typescript
// 有限状态机：减少不可能的状态组合

// ❌ 布尔标志爆炸
const [isLoading, setIsLoading] = useState(false);
const [isError, setIsError] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);
// 可能出现：isLoading=true, isError=true, isSuccess=true（不可能！）

// ✅ 状态机
 type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User }
  | { status: 'error'; error: Error };

function UserProfile({ userId }: { userId: string }) {
  const [state, setState] = useState<FetchState>({ status: 'idle' });

  useEffect(() => {
    setState({ status: 'loading' });
    fetchUser(userId)
      .then((data) => setState({ status: 'success', data }))
      .catch((error) => setState({ status: 'error', error }));
  }, [userId]);

  switch (state.status) {
    case 'idle': return <p>Click to load</p>;
    case 'loading': return <Spinner />;
    case 'success': return <UserCard user={state.data} />;
    case 'error': return <ErrorMessage error={state.error} />;
    default: return null;  // TypeScript 确保 exhaustive check
  }
}
```

## 4. 状态管理选型

| 库 | 适用场景 | 特点 | 包体积 |
|-----|---------|------|--------|
| **useState/useReducer** | 局部状态 | 内置，简单 | 0 |
| **Context** | 主题/配置 | 内置，跨层级 | 0 |
| **Zustand** | 全局状态 | 极简，无 Provider | ~1KB |
| **Jotai** | 原子化状态 | Recoil 简化版 | ~3KB |
| **Valtio** | 可变状态 | Proxy 代理 | ~3KB |
| **Redux Toolkit** | 复杂应用 | 生态丰富 | ~11KB |
| **XState** | 复杂状态机 | 可视化 | ~12KB |
| **TanStack Query** | 服务端状态 | 缓存/同步 | ~12KB |

```typescript
// Zustand 示例
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface BearState {
  bears: number;
  increase: () => void;
  decrease: () => void;
}

const useBearStore = create<BearState>()(
  devtools(
    persist(
      (set) => ({
        bears: 0,
        increase: () => set((state) => ({ bears: state.bears + 1 })),
        decrease: () => set((state) => ({ bears: state.bears - 1 })),
      }),
      { name: 'bear-storage' }
    )
  )
);

// 使用（无 Provider！）
function BearCounter() {
  const bears = useBearStore((state) => state.bears);
  return <h1>{bears} bears</h1>;
}
```

## 5. 状态反模式

```typescript
// ❌ 派生状态存入 State
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);  // 冗余
}, [firstName, lastName]);

// ✅ 使用 useMemo
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);

// ❌ 状态同步（两个状态源）
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);
useEffect(() => {
  setCount(items.length);  // 同步两个状态
}, [items]);

// ✅ 单一数据源
const items = useState([]);
const count = items.length;  // 派生值

// ❌ 过深的嵌套状态
const [state, setState] = useState({
  user: {
    profile: {
      settings: {
        theme: 'dark',
      },
    },
  },
});
// 更新主题需要深拷贝
setState((prev) => ({
  ...prev,
  user: {
    ...prev.user,
    profile: {
      ...prev.user.profile,
      settings: {
        ...prev.user.profile.settings,
        theme: 'light',
      },
    },
  },
}));

// ✅ 扁平化状态 + 分片管理
const useThemeStore = create(() => ({ theme: 'dark' }));
const useUserStore = create(() => ({ name: '' }));
// 或使用 immer
import { produce } from 'immer';
setState(produce((draft) => {
  draft.user.profile.settings.theme = 'light';
}));
```
