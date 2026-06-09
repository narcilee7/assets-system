# 组件设计

## 1. 组件 API 设计原则

```tsx
// ✅ 好的 API：简单、可预测、可组合
<Button variant="primary" size="md" onClick={handleClick}>
  Submit
</Button>

// ✅ 复合组件模式
<Dialog>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Header>Title</Dialog.Header>
    <Dialog.Body>Content</Dialog.Body>
    <Dialog.Footer>
      <Button>Close</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog>
```

## 2. 受控 vs 非受控

```tsx
// 非受控（内部管理状态）
function UncontrolledInput(props) {
  const [value, setValue] = useState(props.defaultValue || '');
  return <input value={value} onChange={(e) => setValue(e.target.value)} {...props} />;
}

// 受控（外部管理状态）
function ControlledInput({ value, onChange, ...props }) {
  return <input value={value} onChange={onChange} {...props} />;
}

// 混合模式（同时支持）
function Input({ value, defaultValue, onChange, ...props }) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  const handleChange = (e) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e.target.value);
  };

  return (
    <input
      value={isControlled ? value : internalValue}
      onChange={handleChange}
      {...props}
    />
  );
}
```

## 3. 变体系统

```tsx
// 使用 class-variance-authority (CVA)
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  // 基础样式
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-blue-500 text-white hover:bg-blue-600',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        ghost: 'hover:bg-gray-100',
        danger: 'bg-red-500 text-white hover:bg-red-600',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}
```

## 4. 组件组合模式

```tsx
// Render Props
<Tooltip content="Help text">
  {(props) => <button {...props}>Hover me</button>}
</Tooltip>

// Compound Components
<Select value={value} onChange={setValue}>
  <Select.Trigger />
  <Select.Portal>
    <Select.Content>
      <Select.Item value="a">Option A</Select.Item>
      <Select.Item value="b">Option B</Select.Item>
    </Select.Content>
  </Select.Portal>
</Select>

// Slots（Vue 风格，React 可用）
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```
