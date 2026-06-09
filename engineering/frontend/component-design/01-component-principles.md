# 组件设计原则

## 1. 单一职责

```tsx
// ❌ 一个组件做太多事
function UserCard({ user, onEdit, onDelete, showAvatar, showBio, isAdmin }) {
  return (
    <div>
      {showAvatar && <img src={user.avatar} />}
      <h3>{user.name}</h3>
      {showBio && <p>{user.bio}</p>}
      {isAdmin && (
        <>
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete}>Delete</button>
        </>
      )}
    </div>
  );
}

// ✅ 拆分为职责单一的组件
function UserCard({ user, actions }) {
  return (
    <Card>
      <Avatar src={user.avatar} />
      <UserInfo name={user.name} bio={user.bio} />
      {actions && <CardActions>{actions}</CardActions>}
    </Card>
  );
}

// 使用
<UserCard
  user={user}
  actions={
    <>
      <Button onClick={handleEdit}>Edit</Button>
      <Button onClick={handleDelete}>Delete</Button>
    </>
  }
/>
```

## 2. 开闭原则

```tsx
// ❌ 每次新需求都要修改组件
function Button({ variant }) {
  if (variant === 'primary') return <button className="bg-blue-500">...</button>;
  if (variant === 'danger') return <button className="bg-red-500">...</button>;
  return <button className="bg-gray-200">...</button>;
}

// ✅ 通过组合扩展，无需修改
function Button({ as: Component = 'button', className, children, ...props }) {
  return (
    <Component className={cx(buttonBase, className)} {...props}>
      {children}
    </Component>
  );
}

// 扩展方式
<Button className="bg-purple-500">Custom</Button>
<Button as="a" href="/link">Link Button</Button>
```

## 3. API 设计规范

```tsx
// ✅ 好的 API：直观、可预测
interface ButtonProps {
  children: React.ReactNode;           // 内容
  variant?: 'primary' | 'secondary' | 'ghost';  // 样式变体
  size?: 'sm' | 'md' | 'lg';          // 尺寸
  disabled?: boolean;                  // 禁用
  loading?: boolean;                   // 加载状态
  onClick?: () => void;                // 交互回调
}

// ✅ 事件命名
onClick      // 点击
onChange     // 值变化
onFocus      // 获得焦点
onBlur       // 失去焦点
onSelect     // 选择
onSubmit     // 提交
onCancel     // 取消

// ✅ 布尔属性命名
isOpen       // 是否打开
isDisabled   // 是否禁用
isLoading    // 是否加载中
isReadOnly   // 是否只读
hasError     // 是否有错误

// ❌ 避免
// onButtonClick（太具体）
// buttonVariant（冗余）
// visible（用 isVisible）
```

## 4. Ref 转发

```tsx
// ✅ 可复用的 Ref 转发
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="input-wrapper">
        {label && <label>{label}</label>}
        <input ref={ref} className={cx('input', error && 'input-error', className)} {...props} />
        {error && <span className="error-text">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// 使用
const inputRef = useRef<HTMLInputElement>(null);
<Input ref={inputRef} label="Email" error={errors.email} />
```
