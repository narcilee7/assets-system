# 手写 Headless UI 基类

## 1. useId（SSR 安全）

```javascript
// useId.js
let idCounter = 0;

function useId() {
  const [id, setId] = useState(() => {
    if (typeof window !== 'undefined') {
      return `id-${++idCounter}`;
    }
    return `ssr-${Math.random().toString(36).slice(2)}`;
  });

  return id;
}

// 或使用 React 18 内置 useId
// import { useId } from 'react';
```

## 2. useDismiss（点击外部/ESC 关闭）

```javascript
// useDismiss.js

function useDismiss(options) {
  const { ref, onDismiss, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onDismiss();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [enabled, onDismiss, ref]);
}

// ============ 使用 ============

function Dropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef();

  useDismiss({
    ref,
    onDismiss: () => setIsOpen(false),
    enabled: isOpen,
  });

  return (
    <div ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && <div className="dropdown-menu">Menu</div>}
    </div>
  );
}
```

## 3. useFocusTrap

```javascript
// useFocusTrap.js

function useFocusTrap(ref, enabled) {
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const element = ref.current;

    // 获取所有可聚焦元素
    const getFocusableElements = () => {
      return element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    };

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTab);

    // 自动聚焦第一个元素
    const focusable = getFocusableElements();
    focusable[0]?.focus();

    return () => {
      element.removeEventListener('keydown', handleTab);
    };
  }, [enabled, ref]);
}
```

## 4. useControllableState

```javascript
// useControllableState.js

function useControllableState(options) {
  const { value, defaultValue, onChange } = options;

  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;

  const currentValue = isControlled ? value : internalValue;

  const setValue = useCallback(
    (nextValue) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      onChange?.(nextValue);
    },
    [isControlled, onChange]
  );

  return [currentValue, setValue];
}

// ============ 使用 ============

function Switch({ checked, defaultChecked, onCheckedChange }) {
  const [isChecked, setIsChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });

  return (
    <button
      role="switch"
      aria-checked={isChecked}
      onClick={() => setIsChecked(!isChecked)}
    >
      {isChecked ? 'On' : 'Off'}
    </button>
  );
}
```
