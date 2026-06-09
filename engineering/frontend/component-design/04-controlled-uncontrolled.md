# 受控与非受控组件

## 1. 完全受控

```tsx
// 状态由父组件管理
function ControlledInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

// 使用
function Form() {
  const [value, setValue] = useState('');
  return <ControlledInput value={value} onChange={setValue} />;
}
```

## 2. 完全非受控

```tsx
// 状态由组件内部管理
function UncontrolledInput({ defaultValue = '' }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
```

## 3. 混合模式（推荐）

```tsx
interface HybridInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

function HybridInput({ value, defaultValue, onChange }: HybridInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || '');

  const currentValue = isControlled ? value : internalValue;

  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return <input value={currentValue} onChange={(e) => handleChange(e.target.value)} />;
}

// 受控使用
<HybridInput value={value} onChange={setValue} />

// 非受控使用
<HybridInput defaultValue="hello" onChange={console.log} />
```

## 4. 使用 Ref 获取值

```tsx
import { useRef, useImperativeHandle, forwardRef } from 'react';

interface FormInputRef {
  getValue: () => string;
  setValue: (v: string) => void;
  focus: () => void;
}

const FormInput = forwardRef<FormInputRef, { defaultValue?: string }>(
  ({ defaultValue = '' }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(defaultValue);

    useImperativeHandle(ref, () => ({
      getValue: () => value,
      setValue: (v) => setValue(v),
      focus: () => inputRef.current?.focus(),
    }));

    return <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} />;
  }
);

// 使用
const inputRef = useRef<FormInputRef>(null);
<FormInput ref={inputRef} />;

// 读取值
console.log(inputRef.current?.getValue());
```
