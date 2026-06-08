# Headless UI

## 1. 核心思想

```
Headless UI = 逻辑 + 可访问性 + 零样式

逻辑层（Headless）          样式层（Consumer）
  ├─ 状态管理                 ├─ Tailwind CSS
  ├─ 键盘导航                 ├─ Styled Components
  ├─ 焦点管理                 ├─ CSS Modules
  ├─ ARIA 属性                └─ 任意样式方案
  └─ 事件处理

优势：
- 逻辑复用，样式自由
- 可访问性内置
- 框架无关（逻辑可提取为 Hooks）
```

## 2. 逻辑提取为 Hooks

```tsx
// useDropdown.ts
interface UseDropdownOptions {
  initialOpen?: boolean;
  onSelect?: (value: string) => void;
}

export function useDropdown(options: UseDropdownOptions = {}) {
  const { initialOpen = false, onSelect } = options;
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const select = useCallback(
    (value: string) => {
      onSelect?.(value);
      close();
    },
    [onSelect, close]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) => i + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(0, i - 1));
          break;
        case 'Enter':
          e.preventDefault();
          // select current
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [isOpen, open, close]
  );

  const triggerProps = {
    ref: triggerRef,
    onClick: toggle,
    onKeyDown: handleKeyDown,
    'aria-expanded': isOpen,
    'aria-haspopup': true,
  };

  const menuProps = {
    ref: menuRef,
    role: 'listbox',
    'aria-activedescendant': `option-${highlightedIndex}`,
  };

  return {
    isOpen,
    highlightedIndex,
    open,
    close,
    toggle,
    select,
    triggerProps,
    menuProps,
  };
}

// ============ 使用（完全自定义样式）===========

function CustomDropdown() {
  const {
    isOpen,
    highlightedIndex,
    toggle,
    select,
    triggerProps,
    menuProps,
  } = useDropdown({ onSelect: console.log });

  return (
    <div>
      <button {...triggerProps} className="my-custom-trigger" onClick={toggle}>
        Select
      </button>
      {isOpen && (
        <div {...menuProps} className="my-custom-menu">
          {['A', 'B', 'C'].map((item, i) => (
            <div
              key={item}
              id={`option-${i}`}
              role="option"
              aria-selected={i === highlightedIndex}
              className={i === highlightedIndex ? 'highlighted' : ''}
              onClick={() => select(item)}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 3. Radix UI 风格

```tsx
// 封装后的 Headless 组件（类似 Radix）
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

function MyDropdown() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="trigger">Open</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="content" sideOffset={5}>
          <DropdownMenu.Item className="item">Item 1</DropdownMenu.Item>
          <DropdownMenu.Item className="item">Item 2</DropdownMenu.Item>
          <DropdownMenu.Separator className="separator" />
          <DropdownMenu.Item className="item danger">Delete</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```
