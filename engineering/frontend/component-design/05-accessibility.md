# 可访问性

## 1. ARIA 属性

```tsx
// ✅ 正确的 ARIA 使用
function Dialog({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      className="dialog-overlay"
      onClick={onClose}
    >
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h2 id="dialog-title">{title}</h2>
        {children}
        <button onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      </div>
    </div>
  );
}

// ✅ 常用 ARIA 模式
// 按钮: <button>（原生，无需 ARIA）
// 链接: <a href="">（原生）

// 自定义按钮
<div role="button" tabIndex={0} aria-pressed={isPressed} onClick={handleClick}>
  Toggle
</div>

// 进度条
<div role="progressbar" aria-valuenow={60} aria-valuemin={0} aria-valuemax={100}>
  <div style={{ width: '60%' }} />
</div>

// 提示信息
<div role="alert" className="error-message">
  Form submission failed
</div>
```

## 2. 键盘导航

```tsx
// ✅ 支持键盘的自定义组件
function Dropdown({ options, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        onSelect(options[highlightedIndex]);
        setIsOpen(false);
        break;
      case 'Escape':
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
    }
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <button ref={buttonRef} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        Select
      </button>
      {isOpen && (
        <ul role="listbox">
          {options.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={i === highlightedIndex}
              className={i === highlightedIndex ? 'highlighted' : ''}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## 3. 焦点管理

```tsx
// 焦点陷阱（Modal 内 Tab 循环）
function useFocusTrap(ref: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const element = ref.current;
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    element.addEventListener('keydown', handleTab);
    first?.focus();

    return () => element.removeEventListener('keydown', handleTab);
  }, [isActive, ref]);
}
```

## 4. 隐藏内容

```tsx
// 屏幕阅读器专用文本
function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">{children}</span>
  );
}

// CSS
// .sr-only {
//   position: absolute;
//   width: 1px; height: 1px;
//   padding: 0; margin: -1px;
//   overflow: hidden;
//   clip: rect(0, 0, 0, 0);
//   white-space: nowrap;
//   border: 0;
// }

// 使用
<button>
  <Icon name="trash" />
  <VisuallyHidden>Delete item</VisuallyHidden>
</button>
```
