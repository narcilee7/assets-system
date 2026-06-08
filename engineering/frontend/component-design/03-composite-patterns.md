# 复合组件模式

## 1. Compound Components

```tsx
// Select.tsx
import { createContext, useContext, useState, useCallback } from 'react';

interface SelectContextValue {
  value: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = useContext(SelectContext);
  if (!context) throw new Error('Select subcomponents must be used within <Select>');
  return context;
}

// 主组件
interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

function Select({ value, onChange, children }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, onChange, isOpen, setIsOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

// 触发器
function Trigger({ children }: { children: React.ReactNode }) {
  const { isOpen, setIsOpen } = useSelectContext();
  return (
    <button onClick={() => setIsOpen(!isOpen)} className="select-trigger">
      {children}
    </button>
  );
}

// 下拉菜单
function Menu({ children }: { children: React.ReactNode }) {
  const { isOpen } = useSelectContext();
  if (!isOpen) return null;
  return <div className="select-menu">{children}</div>;
}

// 选项
function Option({ value, children }: { value: string; children: React.ReactNode }) {
  const { value: selectedValue, onChange, setIsOpen } = useSelectContext();
  const isSelected = value === selectedValue;

  return (
    <div
      className={cx('select-option', isSelected && 'selected')}
      onClick={() => {
        onChange(value);
        setIsOpen(false);
      }}
      role="option"
      aria-selected={isSelected}
    >
      {children}
    </div>
  );
}

Select.Trigger = Trigger;
Select.Menu = Menu;
Select.Option = Option;

// ============ 使用 ============

function App() {
  const [value, setValue] = useState('');

  return (
    <Select value={value} onChange={setValue}>
      <Select.Trigger>{value || 'Select...'}</Select.Trigger>
      <Select.Menu>
        <Select.Option value="a">Option A</Select.Option>
        <Select.Option value="b">Option B</Select.Option>
        <Select.Option value="c">Option C</Select.Option>
      </Select.Menu>
    </Select>
  );
}
```

## 2. Render Props

```tsx
// Tooltip.tsx
interface TooltipProps {
  content: React.ReactNode;
  children: (props: { onMouseEnter: () => void; onMouseLeave: () => void }) => React.ReactNode;
}

function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="tooltip-wrapper">
      {children({
        onMouseEnter: () => setVisible(true),
        onMouseLeave: () => setVisible(false),
      })}
      {visible && <div className="tooltip-content">{content}</div>}
    </div>
  );
}

// 使用
<Tooltip content="Helpful info">
  {({ onMouseEnter, onMouseLeave }) => (
    <button onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      Hover me
    </button>
  )}
</Tooltip>
```

## 3. Slots 模式

```tsx
// Card.tsx
interface CardProps {
  header?: React.ReactNode;
  body: React.ReactNode;
  footer?: React.ReactNode;
}

function Card({ header, body, footer }: CardProps) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{body}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

// 使用
<Card
  header={<h3>Title</h3>}
  body={<p>Content here</p>}
  footer={<Button>Action</Button>}
/>
```
