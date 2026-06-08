# 组件架构

## 1. 原子设计（Atomic Design）

```
原子设计五层：

Atoms（原子）
  ├── Button
  ├── Input
  ├── Label
  ├── Icon
  └── Text

Molecules（分子）
  ├── SearchBar（Input + Button + Icon）
  ├── FormField（Label + Input + ErrorMessage）
  └── CardHeader（Title + Subtitle + Icon）

Organisms（有机体）
  ├── Header（Logo + Navigation + SearchBar + UserMenu）
  ├── ProductCard（Image + Title + Price + Button）
  └── LoginForm（多个 FormField + SubmitButton）

Templates（模板）
  ├── HomePageLayout
  ├── ProductDetailLayout
  └── DashboardLayout

Pages（页面）
  ├── HomePage
  ├── ProductPage
  └── CheckoutPage
```

```typescript
// Atoms/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <button className={`btn btn--${variant} btn--${size}`} {...props} />;
}

// Molecules/SearchBar.tsx
import { Button } from '../atoms/Button';
import { Icon } from '../atoms/Icon';

export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState('');
  return (
    <div className="search-bar">
      <Icon name="search" />
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Button onClick={() => onSearch(query)}>Search</Button>
    </div>
  );
}
```

## 2. 复合组件（Compound Components）

```typescript
// 复合组件：多个相关组件共享隐式状态

// ❌ 传统 Props 钻孔
<Select
  options={options}
  value={value}
  onChange={setValue}
  placeholder="Choose..."
  disabled={false}
  searchable={true}
/>

// ✅ 复合组件
import { Select } from './Select';

<Select value={value} onChange={setValue}>
  <Select.Trigger>
    <Select.Value placeholder="Choose a fruit" />
    <Select.Icon />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content>
      <Select.Viewport>
        <Select.Group>
          <Select.Label>Fruits</Select.Label>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="banana">Banana</Select.Item>
        </Select.Group>
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select>

// 实现
const SelectContext = createContext<SelectContextValue | null>(null);

function Select({ children, value, onChange }: SelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <SelectContext.Provider value={{ value, onChange, open, setOpen }}>
      {children}
    </SelectContext.Provider>
  );
}

Select.Trigger = function SelectTrigger({ children }) {
  const { setOpen } = useSelectContext();
  return <button onClick={() => setOpen((o) => !o)}>{children}</button>;
};

Select.Item = function SelectItem({ value, children }) {
  const { value: selectedValue, onChange } = useSelectContext();
  return (
    <div
      className={selectedValue === value ? 'selected' : ''}
      onClick={() => onChange?.(value)}
    >
      {children}
    </div>
  );
};
```

## 3. Headless UI

```typescript
// Headless UI：提供逻辑和可访问性，无样式

// ❌ 带样式的组件库
import { Button } from 'ui-library';  // 样式不可控

// ✅ Headless UI（如 Radix UI, Headless UI）
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root>
  <Dialog.Trigger asChild>
    <button className="my-custom-button">Open</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="my-overlay" />
    <Dialog.Content className="my-content">
      <Dialog.Title>Confirm</Dialog.Title>
      <Dialog.Description>Are you sure?</Dialog.Description>
      <Dialog.Close asChild>
        <button>Close</button>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

// 优势：
// 1. 完全控制样式（CSS/Tailwind/Styled）
// 2. 内置可访问性（ARIA、键盘导航、焦点管理）
// 3. 行为可定制
```

## 4. 容器/展示分离

```typescript
// 容器组件：关心"怎么做"
function UserListContainer() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const deleteUser = useMutation({
    mutationFn: deleteUserApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  if (isLoading) return <Skeleton />;

  return <UserListView users={users} onDelete={deleteUser.mutate} />;
}

// 展示组件：关心"长什么样"
interface UserListViewProps {
  users: User[];
  onDelete: (id: string) => void;
}

function UserListView({ users, onDelete }: UserListViewProps) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          <span>{user.name}</span>
          <button onClick={() => onDelete(user.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}

// 测试展示组件很简单（纯函数）：
// render(<UserListView users={mockUsers} onDelete={vi.fn()} />);
```
