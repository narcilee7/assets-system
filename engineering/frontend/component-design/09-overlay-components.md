# 弹层组件

## 1. Portal 封装

```tsx
// Portal.tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  container?: HTMLElement;
}

export function Portal({ children, container }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(children, container || document.body);
}
```

## 2. Modal 组件

```tsx
// Modal.tsx
import { useEffect, useRef, useCallback } from 'react';
import { Portal } from './Portal';
import { useFocusTrap } from './useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useFocusTrap(contentRef, isOpen);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 点击 overlay 关闭
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  // 禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        ref={overlayRef}
        className="modal-overlay"
        onClick={handleOverlayClick}
        role="presentation"
      >
        <div
          ref={contentRef}
          className="modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <h2 id="modal-title">{title}</h2>
          <button onClick={onClose} aria-label="Close modal">
            ×
          </button>
          <div>{children}</div>
        </div>
      </div>
    </Portal>
  );
}
```

## 3. 堆叠管理（z-index）

```tsx
// useStack.ts
let stackCounter = 0;

export function useStack() {
  const [zIndex, setZIndex] = useState(0);

  useEffect(() => {
    stackCounter += 1;
    setZIndex(stackCounter);

    return () => {
      stackCounter -= 1;
    };
  }, []);

  return zIndex;
}

// 使用
function Tooltip() {
  const zIndex = useStack();
  return <div style={{ zIndex: 1000 + zIndex }}>Tooltip</div>;
}
```

## 4. Toast 通知系统

```tsx
// Toast 堆叠管理
interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36);
    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 3000);
  }, []);

  return (
    <Portal>
      <div className="toast-container" role="region" aria-live="polite">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            style={{ transform: `translateY(${index * 60}px)` }}
            role="alert"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </Portal>
  );
}
```
